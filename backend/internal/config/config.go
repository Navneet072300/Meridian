package config

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
)

var (
	DatabaseURL    = env("DATABASE_URL", "")
	RedisURL       = env("REDIS_URL", "redis://localhost:6379/0")
	JWTSecret      = env("JWT_SECRET", "change-me-in-production")
	ResendAPIKey   = env("RESEND_API_KEY", "")
	FrontendURL    = env("FRONTEND_URL", "http://localhost:3000")
	EncryptionKey  = env("ENCRYPTION_KEY", "00000000000000000000000000000000") // 32 bytes hex

	GoogleClientID     = env("GOOGLE_CLIENT_ID", "")
	GoogleClientSecret = env("GOOGLE_CLIENT_SECRET", "")
	GoogleRedirectURI  = envFallback("GOOGLE_REDIRECT_URI", FrontendURL+"/api/auth/google/callback")
	GitHubClientID     = env("GITHUB_CLIENT_ID", "")
	GitHubClientSecret = env("GITHUB_CLIENT_SECRET", "")
	GitHubRedirectURI  = envFallback("GITHUB_REDIRECT_URI", FrontendURL+"/api/auth/github/callback")
	GitLabClientID     = env("GITLAB_CLIENT_ID", "")
	GitLabClientSecret = env("GITLAB_CLIENT_SECRET", "")
	GitLabURL          = env("GITLAB_URL", "https://gitlab.com")
	GitLabRedirectURI  = envFallback("GITLAB_REDIRECT_URI", FrontendURL+"/api/auth/gitlab/callback")

	TFAPIKey  = env("TF_API_KEY", "")
	TFModel   = env("TF_MODEL", "openai/gpt-oss-120b")
	TFBaseURL = env("TF_BASE_URL", "https://api.tokenfactory.iamsaif.ai/v1")
	OllamaURL = env("OLLAMA_URL", "")
	OllamaModel = env("OLLAMA_MODEL", "gemma4:31b")
	GroqAPIKey  = env("GROQ_API_KEY", "")
	GroqModel   = env("GROQ_MODEL", "llama-3.3-70b-versatile")

	MonitorPollInterval = envInt("MONITOR_POLL_INTERVAL", 60)
	ConfigFile          = env("CONFIG_FILE", "config/platforms.json")
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envFallback(key, fallback string) string {
	return env(key, fallback)
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	var i int
	if _, err := parseIntSafe(v, &i); err != nil {
		return fallback
	}
	return i
}

func parseIntSafe(s string, out *int) (int, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, os.ErrInvalid
		}
		n = n*10 + int(c-'0')
	}
	*out = n
	return n, nil
}

// ── platforms.json config store ─────────────────────────────────────────────

type PlatformConfig struct {
	Clusters          []ClusterConfig        `json:"clusters,omitempty"`
	GitHub            map[string]string      `json:"github,omitempty"`
	Vault             map[string]string      `json:"vault,omitempty"`
	Cloudflare        map[string]string      `json:"cloudflare,omitempty"`
	ArgoCD            map[string]string      `json:"argocd,omitempty"`
	SelectedPlatforms []string               `json:"selected_platforms,omitempty"`
	Extra             map[string]interface{} `json:"-"`
}

type ClusterConfig struct {
	Name           string `json:"name"`
	Environment    string `json:"environment"`
	ConnectionType string `json:"connection_type"`
	APIURL         string `json:"api_url,omitempty"`
	Token          string `json:"token,omitempty"`
	Kubeconfig     string `json:"kubeconfig,omitempty"`
	Active         bool   `json:"active,omitempty"`
}

var cfgMu sync.RWMutex

func LoadPlatformConfig() PlatformConfig {
	cfgMu.RLock()
	defer cfgMu.RUnlock()

	data, err := os.ReadFile(ConfigFile)
	if err != nil {
		return PlatformConfig{}
	}
	var cfg PlatformConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		log.Printf("platforms.json parse error: %v", err)
		return PlatformConfig{}
	}
	return cfg
}

func SavePlatformConfig(cfg PlatformConfig) error {
	cfgMu.Lock()
	defer cfgMu.Unlock()

	if err := os.MkdirAll(filepath.Dir(ConfigFile), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(ConfigFile, data, 0o600)
}

func GetActiveCluster() *ClusterConfig {
	cfg := LoadPlatformConfig()
	for i := range cfg.Clusters {
		if cfg.Clusters[i].Active {
			return &cfg.Clusters[i]
		}
	}
	if len(cfg.Clusters) > 0 {
		return &cfg.Clusters[0]
	}
	return nil
}

func GetCluster(name string) *ClusterConfig {
	cfg := LoadPlatformConfig()
	for i := range cfg.Clusters {
		if cfg.Clusters[i].Name == name {
			return &cfg.Clusters[i]
		}
	}
	return nil
}

func Mask(value string) string {
	if len(value) <= 4 {
		return "***"
	}
	return value[:4] + "***"
}
