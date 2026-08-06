package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"meridian/internal/config"
)

func GitHubListRepos(w http.ResponseWriter, r *http.Request) {
	pat, _ := getPlatformSetting("github.pat")
	if pat == "" {
		writeJSON(w, 200, map[string]interface{}{"repos": []interface{}{}, "error": "GitHub PAT not configured"})
		return
	}

	data, err := httpGetSlice("https://api.github.com/user/repos?per_page=100&sort=updated", pat)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"repos": []interface{}{}, "error": err.Error()})
		return
	}

	repos := make([]map[string]interface{}, 0, len(data))
	for _, item := range data {
		if m, ok := item.(map[string]interface{}); ok {
			repos = append(repos, map[string]interface{}{
				"full_name":      m["full_name"],
				"name":           m["name"],
				"private":        m["private"],
				"default_branch": m["default_branch"],
				"language":       m["language"],
				"updated_at":     m["updated_at"],
				"clone_url":      m["clone_url"],
			})
		}
	}
	writeJSON(w, 200, map[string]interface{}{"repos": repos})
}

func GitHubListBranches(w http.ResponseWriter, r *http.Request) {
	pat, _ := getPlatformSetting("github.pat")
	repo := r.URL.Query().Get("repo")
	if pat == "" || repo == "" {
		writeJSON(w, 200, map[string]interface{}{"branches": []interface{}{}})
		return
	}

	data, err := httpGetSlice(fmt.Sprintf("https://api.github.com/repos/%s/branches", repo), pat)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"branches": []interface{}{}, "error": err.Error()})
		return
	}

	branches := make([]string, 0, len(data))
	for _, item := range data {
		if m, ok := item.(map[string]interface{}); ok {
			if name, ok := m["name"].(string); ok {
				branches = append(branches, name)
			}
		}
	}
	writeJSON(w, 200, map[string]interface{}{"branches": branches})
}

func GitHubStatus(w http.ResponseWriter, r *http.Request) {
	pat, _ := getPlatformSetting("github.pat")
	username, _ := getPlatformSetting("github.username")
	if pat == "" {
		writeJSON(w, 200, map[string]interface{}{"connected": false})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"connected": true, "username": username})
}

func GitHubSavePAT(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PAT string `json:"pat"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.PAT == "" {
		writeError(w, 400, "PAT required")
		return
	}
	cfg := config.LoadPlatformConfig()
	if cfg.GitHub == nil {
		cfg.GitHub = map[string]string{}
	}
	cfg.GitHub["pat"] = req.PAT
	config.SavePlatformConfig(cfg)
	writeJSON(w, 200, map[string]string{"message": "PAT saved"})
}

func getPlatformSetting(key string) (string, error) {
	cfg := config.LoadPlatformConfig()
	for i, c := range key {
		if c == '.' {
			section := key[:i]
			field := key[i+1:]
			var m map[string]string
			switch section {
			case "github":
				m = cfg.GitHub
			case "vault":
				m = cfg.Vault
			case "cloudflare":
				m = cfg.Cloudflare
			case "argocd":
				m = cfg.ArgoCD
			}
			if m != nil {
				return m[field], nil
			}
			return "", nil
		}
	}
	return "", nil
}
