// Stub handlers for routes that exist in the Python backend.
// These return valid responses so the frontend doesn't break.
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"meridian/internal/services"
)

// ── Platform / onboarding ─────────────────────────────────────────────────────

func PlatformGet(w http.ResponseWriter, r *http.Request) {
	SettingsGetPlatform(w, r)
}

func PlatformSave(w http.ResponseWriter, r *http.Request) {
	SettingsSavePlatform(w, r)
}

func PlatformConfig(w http.ResponseWriter, r *http.Request) {
	SettingsGetPlatform(w, r)
}

// ── Subscription ──────────────────────────────────────────────────────────────

func SubscriptionGet(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	_ = uid
	writeJSON(w, 200, map[string]interface{}{
		"plan":       "free",
		"status":     "active",
		"seats_used": 1,
		"seats_max":  1,
	})
}

func SubscriptionUpgrade(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"message": "Contact sales@meridian.dev to upgrade"})
}

// ── Support ───────────────────────────────────────────────────────────────────

func SupportTicketCreate(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"message": "Support request received"})
}

// ── Implement (AI code generation) ───────────────────────────────────────────

func ImplementGenerate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Prompt  string `json:"prompt"`
		Context string `json:"context"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	sseHeaders(w)
	var buf bytes.Buffer
	err := services.AI.StreamGenerate(r.Context(), &buf, "You are an expert software engineer. Generate production-ready implementation code.", req.Prompt, 4096)
	content := buf.String()
	if err != nil {
		sseWrite(w, map[string]interface{}{"error": err.Error(), "done": true})
		return
	}
	for i := 0; i < len(content); i += 64 {
		end := i + 64
		if end > len(content) {
			end = len(content)
		}
		sseWrite(w, map[string]interface{}{"chunk": content[i:end], "done": false})
	}
	sseWrite(w, map[string]interface{}{"done": true})
}

// ── Design ────────────────────────────────────────────────────────────────────

func DesignGenerate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Prompt string `json:"prompt"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	sseHeaders(w)
	system := "You are a UI/UX design system expert. Generate Tailwind CSS and React component code."
	var buf bytes.Buffer
	err := services.AI.StreamGenerate(r.Context(), &buf, system, req.Prompt, 4096)
	content := buf.String()
	if err != nil {
		sseWrite(w, map[string]interface{}{"error": err.Error(), "done": true})
		return
	}
	for i := 0; i < len(content); i += 64 {
		end := i + 64
		if end > len(content) {
			end = len(content)
		}
		sseWrite(w, map[string]interface{}{"chunk": content[i:end], "done": false})
	}
	sseWrite(w, map[string]interface{}{"done": true})
}

// ── Vault ─────────────────────────────────────────────────────────────────────

func VaultStatus(w http.ResponseWriter, r *http.Request) {
	cfg, _ := getPlatformSetting("vault.url")
	writeJSON(w, 200, map[string]interface{}{
		"configured": cfg != "",
		"url":        cfg,
	})
}

func VaultSecrets(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{"secrets": []interface{}{}})
}

// ── Agent ─────────────────────────────────────────────────────────────────────

func AgentChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message  string                   `json:"message"`
		Messages []map[string]interface{} `json:"messages"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	sseHeaders(w)
	system := "You are Meridian AI, a DevOps assistant. Help the user with Kubernetes, Docker, CI/CD, and cloud infrastructure."
	var buf bytes.Buffer
	err := services.AI.StreamGenerate(r.Context(), &buf, system, req.Message, 2048)
	content := buf.String()
	if err != nil {
		sseWrite(w, map[string]interface{}{"error": err.Error(), "done": true})
		return
	}
	for i := 0; i < len(content); i += 64 {
		end := i + 64
		if end > len(content) {
			end = len(content)
		}
		sseWrite(w, map[string]interface{}{"chunk": content[i:end], "done": false})
	}
	sseWrite(w, map[string]interface{}{"done": true})
}

// ── Agent management ──────────────────────────────────────────────────────────

func AgentTokenCreate(w http.ResponseWriter, r *http.Request) {
	_, ok := requireUser(w, r)
	if !ok {
		return
	}
	writeJSON(w, 201, map[string]string{
		"token":  "mrd-agent-" + genID(),
		"message": "Token created",
	})
}

func AgentTokenList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{"tokens": []interface{}{}})
}

func AgentTokenRevoke(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(204)
}

// ── Agent metrics (Helm agent) ────────────────────────────────────────────────

func AgentMetricsPush(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"message": "Metrics received"})
}

func AgentMetricsGet(w http.ResponseWriter, r *http.Request) {
	cluster := chi.URLParam(r, "cluster")
	_ = cluster
	writeJSON(w, 200, map[string]interface{}{"metrics": []interface{}{}})
}

// ── Deployments (running workloads view) ─────────────────────────────────────

func DeploymentsList(w http.ResponseWriter, r *http.Request) {
	svc, err := getK8sService(r)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"deployments": []interface{}{}})
		return
	}
	result, _ := svc.GetAllResources(r.Context(), r.URL.Query().Get("namespace"))
	deps := result["deployments"]
	if deps == nil {
		deps = []interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"deployments": deps})
}
