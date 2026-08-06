package services

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"meridian/internal/config"
)

const devopsSystem = `You are an expert DevOps engineer with deep knowledge of the full DevOps toolchain: Docker, Docker Compose, Kubernetes, Helm, Kustomize, Terraform, Pulumi, CDK, Ansible, Jenkins, GitHub Actions, GitLab CI, CircleCI, ArgoCD, Flux, Prometheus, Grafana, Nginx, Traefik, HashiCorp Vault, and all major clouds (AWS, GCP, Azure).

Generate production-ready files for WHATEVER the user requests. Format multi-file output using EXACTLY this separator format:
--- FILE: path/to/filename ---
[file content]

REQUIRED: After all generated files, always append a file named 'guideme.md' using the same --- FILE: guideme.md --- separator.`

const sreSystem = `You are a senior SRE with expertise in Kubernetes troubleshooting. Analyze the provided logs and events. Return structured diagnosis using these headers: ## SEVERITY, ## ROOT CAUSE, ## DETAILS, ## SUGGESTED FIX, ## BEFORE, ## AFTER, ## PREVENTION.`

type AIService struct {
	httpClient *http.Client
}

var AI = &AIService{
	httpClient: &http.Client{Timeout: 130 * time.Second},
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// StreamDevops streams a devops generation response to w (SSE format).
func (s *AIService) StreamDevops(ctx context.Context, w io.Writer, prompt string, tools []string, contextStr string) error {
	system := devopsSystem
	if len(tools) > 0 {
		system += "\nPrimary tools: " + strings.Join(tools, ", ")
	}
	if contextStr != "" {
		system += "\nPlatform context: " + contextStr
	}
	return s.stream(ctx, w, system, prompt, 4096, "devops")
}

// StreamDiagnose streams SRE diagnosis.
func (s *AIService) StreamDiagnose(ctx context.Context, w io.Writer, logs, events string) error {
	content := "Container logs:\n" + logs
	if events != "" {
		content += "\n\nKubernetes events:\n" + events
	}
	return s.stream(ctx, w, sreSystem, content, 2048, "diagnose")
}

// StreamGenerate streams with a custom system prompt.
func (s *AIService) StreamGenerate(ctx context.Context, w io.Writer, system, prompt string, maxTokens int) error {
	return s.stream(ctx, w, system, prompt, maxTokens, "generate")
}

// StreamChat streams a multi-turn chat.
func (s *AIService) StreamChat(ctx context.Context, w io.Writer, system string, messages []chatMessage, maxTokens int) error {
	return s.chatStream(ctx, w, system, messages, maxTokens)
}

func (s *AIService) stream(ctx context.Context, w io.Writer, system, prompt string, maxTokens int, tag string) error {
	msgs := []chatMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: prompt},
	}
	return s.chatStream(ctx, w, system, msgs[1:], maxTokens)
}

func (s *AIService) chatStream(ctx context.Context, w io.Writer, system string, messages []chatMessage, maxTokens int) error {
	allMsgs := append([]chatMessage{{Role: "system", Content: system}}, messages...)

	// 1. TokenFactory
	if config.TFAPIKey != "" {
		err := s.openAICompatStream(ctx, w, config.TFBaseURL+"/chat/completions", config.TFAPIKey, config.TFModel, allMsgs, maxTokens)
		if err == nil {
			return nil
		}
		log.Printf("AI: TokenFactory failed: %v — trying Ollama", err)
	}

	// 2. Ollama
	if config.OllamaURL != "" {
		err := s.ollamaStream(ctx, w, allMsgs, maxTokens)
		if err == nil {
			return nil
		}
		log.Printf("AI: Ollama failed: %v — trying Groq", err)
	}

	// 3. Groq
	if config.GroqAPIKey != "" {
		return s.openAICompatStream(ctx, w, "https://api.groq.com/openai/v1/chat/completions", config.GroqAPIKey, config.GroqModel, allMsgs, maxTokens)
	}

	return fmt.Errorf("no AI provider available — set TF_API_KEY, OLLAMA_URL, or GROQ_API_KEY")
}

func (s *AIService) openAICompatStream(ctx context.Context, w io.Writer, url, apiKey, model string, messages []chatMessage, maxTokens int) error {
	payload := map[string]interface{}{
		"model":      model,
		"messages":   messages,
		"max_tokens": maxTokens,
		"stream":     true,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(line[5:])
		if data == "[DONE]" {
			break
		}
		var obj map[string]interface{}
		if err := json.Unmarshal([]byte(data), &obj); err != nil {
			continue
		}
		choices, _ := obj["choices"].([]interface{})
		if len(choices) == 0 {
			continue
		}
		delta, _ := choices[0].(map[string]interface{})["delta"].(map[string]interface{})
		if token, ok := delta["content"].(string); ok && token != "" {
			if _, err := w.Write([]byte(token)); err != nil {
				return err
			}
		}
	}
	return scanner.Err()
}

func (s *AIService) ollamaStream(ctx context.Context, w io.Writer, messages []chatMessage, maxTokens int) error {
	payload := map[string]interface{}{
		"model":    config.OllamaModel,
		"messages": messages,
		"stream":   true,
		"options":  map[string]int{"num_predict": maxTokens},
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(config.OllamaURL, "/")+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("Ollama HTTP %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		var obj map[string]interface{}
		if err := json.Unmarshal(scanner.Bytes(), &obj); err != nil {
			continue
		}
		if msg, ok := obj["message"].(map[string]interface{}); ok {
			if token, ok := msg["content"].(string); ok && token != "" {
				if _, err := w.Write([]byte(token)); err != nil {
					return err
				}
			}
		}
		if done, _ := obj["done"].(bool); done {
			break
		}
	}
	return scanner.Err()
}
