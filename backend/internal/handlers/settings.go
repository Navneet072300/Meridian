package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"meridian/internal/config"
	"meridian/internal/db"
	"meridian/internal/services"
)

// ── Cluster management ────────────────────────────────────────────────────────

func SettingsListClusters(w http.ResponseWriter, r *http.Request) {
	cfg := config.LoadPlatformConfig()
	clusters := make([]map[string]interface{}, 0, len(cfg.Clusters))
	for _, c := range cfg.Clusters {
		clusters = append(clusters, map[string]interface{}{
			"name":            c.Name,
			"environment":     c.Environment,
			"connection_type": c.ConnectionType,
			"api_url":         c.APIURL,
			"token":           config.Mask(c.Token),
			"active":          c.Active,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"clusters": clusters})
}

func SettingsCreateCluster(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name           string `json:"name"`
		Environment    string `json:"environment"`
		ConnectionType string `json:"connection_type"`
		APIURL         string `json:"api_url"`
		Token          string `json:"token"`
		Kubeconfig     string `json:"kubeconfig"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	cfg := config.LoadPlatformConfig()
	for _, c := range cfg.Clusters {
		if c.Name == req.Name {
			writeError(w, 409, "Cluster name already exists")
			return
		}
	}

	env := req.Environment
	if env == "" {
		env = "dev"
	}
	ct := req.ConnectionType
	if ct == "" {
		ct = "token"
	}

	newCluster := config.ClusterConfig{
		Name:           req.Name,
		Environment:    env,
		ConnectionType: ct,
		APIURL:         req.APIURL,
		Token:          req.Token,
		Kubeconfig:     req.Kubeconfig,
		Active:         len(cfg.Clusters) == 0,
	}
	cfg.Clusters = append(cfg.Clusters, newCluster)
	config.SavePlatformConfig(cfg)

	services.CacheDelete(r.Context(), "overview:*")
	writeJSON(w, 201, map[string]interface{}{
		"name":        newCluster.Name,
		"environment": newCluster.Environment,
		"active":      newCluster.Active,
	})
}

func SettingsUpdateCluster(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	var req struct {
		Environment    *string `json:"environment"`
		ConnectionType *string `json:"connection_type"`
		APIURL         *string `json:"api_url"`
		Token          *string `json:"token"`
		Kubeconfig     *string `json:"kubeconfig"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	cfg := config.LoadPlatformConfig()
	updated := false
	for i := range cfg.Clusters {
		if cfg.Clusters[i].Name == name {
			if req.Environment != nil {
				cfg.Clusters[i].Environment = *req.Environment
			}
			if req.ConnectionType != nil {
				cfg.Clusters[i].ConnectionType = *req.ConnectionType
			}
			if req.APIURL != nil && *req.APIURL != "" {
				cfg.Clusters[i].APIURL = *req.APIURL
			}
			if req.Token != nil && *req.Token != "" && !containsMask(*req.Token) {
				cfg.Clusters[i].Token = *req.Token
			}
			if req.Kubeconfig != nil && *req.Kubeconfig != "" && !containsMask(*req.Kubeconfig) {
				cfg.Clusters[i].Kubeconfig = *req.Kubeconfig
			}
			updated = true
			break
		}
	}
	if !updated {
		writeError(w, 404, "Cluster not found")
		return
	}
	config.SavePlatformConfig(cfg)
	services.CacheDelete(r.Context(), "overview:*")
	writeJSON(w, 200, map[string]string{"message": "Cluster updated"})
}

func SettingsDeleteCluster(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	cfg := config.LoadPlatformConfig()
	newClusters := make([]config.ClusterConfig, 0, len(cfg.Clusters))
	found := false
	for _, c := range cfg.Clusters {
		if c.Name == name {
			found = true
			continue
		}
		newClusters = append(newClusters, c)
	}
	if !found {
		writeError(w, 404, "Cluster not found")
		return
	}
	if len(newClusters) > 0 && !anyActive(newClusters) {
		newClusters[0].Active = true
	}
	cfg.Clusters = newClusters
	config.SavePlatformConfig(cfg)
	services.CacheDelete(r.Context(), "overview:*")
	w.WriteHeader(204)
}

func SettingsSetActiveCluster(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	cfg := config.LoadPlatformConfig()
	found := false
	for i := range cfg.Clusters {
		cfg.Clusters[i].Active = cfg.Clusters[i].Name == name
		if cfg.Clusters[i].Active {
			found = true
		}
	}
	if !found {
		writeError(w, 404, "Cluster not found")
		return
	}
	config.SavePlatformConfig(cfg)
	services.CacheDelete(r.Context(), "overview:*")
	writeJSON(w, 200, map[string]string{"message": "Active cluster set"})
}

func SettingsTestCluster(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	cluster := config.GetCluster(name)
	if cluster == nil {
		writeError(w, 404, "Cluster not found")
		return
	}
	svc, err := services.NewK8sService(cluster.APIURL, cluster.Token, cluster.Kubeconfig)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}
	result := svc.Health(r.Context())
	writeJSON(w, 200, result)
}

// ── User settings ─────────────────────────────────────────────────────────────

func SettingsGetUser(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var s db.UserSettings
	err := db.Pool.QueryRow(r.Context(),
		`SELECT id, user_id, timezone, default_environment, default_iac_tool, default_cloud,
		        default_namespace, code_font_size, avatar_color, notification_prefs,
		        ai_primary_endpoint, ai_primary_model, ai_secondary_endpoint, ai_secondary_model,
		        ai_temperature, ai_max_tokens, ai_streaming, ai_system_prompt_addendum,
		        workspace_name, require_2fa_team, default_member_role, experience_level,
		        secrets_json, grafana_org_id, monitoring_enabled, updated_at
		 FROM user_settings WHERE user_id=$1`, uid,
	).Scan(&s.ID, &s.UserID, &s.Timezone, &s.DefaultEnvironment, &s.DefaultIACTool, &s.DefaultCloud,
		&s.DefaultNamespace, &s.CodeFontSize, &s.AvatarColor, &s.NotificationPrefs,
		&s.AIPrimaryEndpoint, &s.AIPrimaryModel, &s.AISecondaryEndpoint, &s.AISecondaryModel,
		&s.AITemperature, &s.AIMaxTokens, &s.AIStreaming, &s.AISystemPromptAddendum,
		&s.WorkspaceName, &s.Require2FATeam, &s.DefaultMemberRole, &s.ExperienceLevel,
		&s.SecretsJSON, &s.GrafanaOrgID, &s.MonitoringEnabled, &s.UpdatedAt)

	if err != nil {
		// Auto-create settings
		db.Pool.Exec(r.Context(), `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, uid)
		writeJSON(w, 200, defaultSettings(uid))
		return
	}
	writeJSON(w, 200, settingsToMap(&s))
}

func SettingsUpdateUser(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)

	// Ensure row exists
	db.Pool.Exec(r.Context(), `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, uid)

	// Update each field dynamically
	allowedFields := map[string]string{
		"timezone":                  "timezone",
		"default_environment":       "default_environment",
		"default_iac_tool":          "default_iac_tool",
		"default_cloud":             "default_cloud",
		"default_namespace":         "default_namespace",
		"code_font_size":            "code_font_size",
		"avatar_color":              "avatar_color",
		"notification_prefs":        "notification_prefs",
		"ai_primary_endpoint":       "ai_primary_endpoint",
		"ai_primary_model":          "ai_primary_model",
		"ai_secondary_endpoint":     "ai_secondary_endpoint",
		"ai_secondary_model":        "ai_secondary_model",
		"ai_temperature":            "ai_temperature",
		"ai_max_tokens":             "ai_max_tokens",
		"ai_streaming":              "ai_streaming",
		"ai_system_prompt_addendum": "ai_system_prompt_addendum",
		"workspace_name":            "workspace_name",
		"require_2fa_team":          "require_2fa_team",
		"default_member_role":       "default_member_role",
		"experience_level":          "experience_level",
		"grafana_org_id":            "grafana_org_id",
		"monitoring_enabled":        "monitoring_enabled",
	}

	for reqKey, col := range allowedFields {
		if val, ok := req[reqKey]; ok {
			db.Pool.Exec(r.Context(),
				`UPDATE user_settings SET `+col+`=$1, updated_at=NOW() WHERE user_id=$2`,
				val, uid,
			)
		}
	}

	writeJSON(w, 200, map[string]string{"message": "Settings updated"})
}

// ── Secrets ───────────────────────────────────────────────────────────────────

func SettingsListSecrets(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !db.Available() {
		writeJSON(w, 200, map[string]interface{}{"secrets": []interface{}{}})
		return
	}

	rows, _ := db.Pool.Query(r.Context(),
		`SELECT id, name, secret_type, description, created_at, updated_at
		 FROM user_secrets WHERE user_id=$1 ORDER BY name`, uid,
	)
	defer rows.Close()

	secrets := []map[string]interface{}{}
	for rows.Next() {
		var id, name, secretType string
		var description *string
		var createdAt, updatedAt time.Time
		rows.Scan(&id, &name, &secretType, &description, &createdAt, &updatedAt)
		secrets = append(secrets, map[string]interface{}{
			"id":          id,
			"name":        name,
			"secret_type": secretType,
			"description": description,
			"created_at":  createdAt.Format(time.RFC3339),
			"updated_at":  updatedAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, 200, map[string]interface{}{"secrets": secrets})
}

func SettingsCreateSecret(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		Name        string `json:"name"`
		Value       string `json:"value"`
		SecretType  string `json:"secret_type"`
		Description string `json:"description"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.SecretType == "" {
		req.SecretType = "other"
	}

	encrypted, err := services.Encrypt(req.Value)
	if err != nil {
		writeError(w, 500, "Encryption failed")
		return
	}

	var id string
	db.Pool.QueryRow(r.Context(),
		`INSERT INTO user_secrets (user_id, name, value_encrypted, secret_type, description)
		 VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, name)
		 DO UPDATE SET value_encrypted=EXCLUDED.value_encrypted, updated_at=NOW()
		 RETURNING id`,
		uid, req.Name, encrypted, req.SecretType, nullStr(req.Description),
	).Scan(&id)

	writeJSON(w, 201, map[string]string{"id": id, "message": "Secret saved"})
}

func SettingsDeleteSecret(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	secretID := chi.URLParam(r, "id")
	if db.Available() {
		db.Pool.Exec(r.Context(),
			`DELETE FROM user_secrets WHERE id=$1 AND user_id=$2`, secretID, uid,
		)
	}
	w.WriteHeader(204)
}

// ── Platform settings ─────────────────────────────────────────────────────────

func SettingsGetPlatform(w http.ResponseWriter, r *http.Request) {
	cfg := config.LoadPlatformConfig()
	out := map[string]interface{}{
		"clusters":           maskClusters(cfg.Clusters),
		"selected_platforms": cfg.SelectedPlatforms,
		"configured":         len(cfg.Clusters) > 0,
	}
	for _, platform := range []string{"github", "vault", "cloudflare", "argocd"} {
		var m map[string]string
		switch platform {
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
			masked := map[string]interface{}{}
			for k, v := range m {
				if k == "pat" || k == "token" || k == "password" || k == "api_key" {
					masked[k] = config.Mask(v)
				} else {
					masked[k] = v
				}
			}
			masked["configured"] = true
			out[platform] = masked
		}
	}
	writeJSON(w, 200, out)
}

func SettingsSavePlatform(w http.ResponseWriter, r *http.Request) {
	var raw map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	cfg := config.LoadPlatformConfig()

	// Update selected_platforms
	if sp, ok := raw["selected_platforms"].([]interface{}); ok {
		cfg.SelectedPlatforms = make([]string, 0, len(sp))
		for _, v := range sp {
			if s, ok := v.(string); ok {
				cfg.SelectedPlatforms = append(cfg.SelectedPlatforms, s)
			}
		}
	}

	// Update clusters
	if clusters, ok := raw["clusters"].([]interface{}); ok {
		cfg.Clusters = make([]config.ClusterConfig, 0, len(clusters))
		for _, ci := range clusters {
			if cm, ok := ci.(map[string]interface{}); ok {
				c := config.ClusterConfig{
					Name:           strIface(cm["name"]),
					Environment:    strIface(cm["environment"]),
					ConnectionType: strIface(cm["connection_type"]),
					APIURL:         strIface(cm["api_url"]),
					Token:          strIface(cm["token"]),
					Kubeconfig:     strIface(cm["kubeconfig"]),
				}
				if a, ok := cm["active"].(bool); ok {
					c.Active = a
				}
				cfg.Clusters = append(cfg.Clusters, c)
			}
		}
		if len(cfg.Clusters) > 0 && !anyActive(cfg.Clusters) {
			cfg.Clusters[0].Active = true
		}
	}

	// Update platform configs
	for _, p := range []string{"github", "vault", "cloudflare", "argocd"} {
		if pm, ok := raw[p].(map[string]interface{}); ok {
			m := map[string]string{}
			for k, v := range pm {
				if s, ok := v.(string); ok && s != "" && !containsMask(s) {
					m[k] = s
				}
			}
			switch p {
			case "github":
				cfg.GitHub = m
			case "vault":
				cfg.Vault = m
			case "cloudflare":
				cfg.Cloudflare = m
			case "argocd":
				cfg.ArgoCD = m
			}
		}
	}

	config.SavePlatformConfig(cfg)
	services.CacheDelete(r.Context(), "overview:*")
	writeJSON(w, 200, map[string]string{"message": "Platform config saved"})
}

// ── helpers ───────────────────────────────────────────────────────────────────

func containsMask(s string) bool {
	for i := 0; i < len(s)-2; i++ {
		if s[i] == '*' && s[i+1] == '*' && s[i+2] == '*' {
			return true
		}
	}
	return false
}

func anyActive(clusters []config.ClusterConfig) bool {
	for _, c := range clusters {
		if c.Active {
			return true
		}
	}
	return false
}

func maskClusters(clusters []config.ClusterConfig) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(clusters))
	for _, c := range clusters {
		out = append(out, map[string]interface{}{
			"name":            c.Name,
			"environment":     c.Environment,
			"connection_type": c.ConnectionType,
			"api_url":         c.APIURL,
			"token":           config.Mask(c.Token),
			"active":          c.Active,
		})
	}
	return out
}

func defaultSettings(uid int) map[string]interface{} {
	return map[string]interface{}{
		"user_id":               uid,
		"timezone":              "UTC",
		"default_environment":   "dev",
		"default_iac_tool":      "terraform",
		"default_cloud":         "aws",
		"default_namespace":     "default",
		"code_font_size":        14,
		"ai_primary_model":      "gemma4",
		"ai_secondary_model":    "qwen3:32b",
		"ai_temperature":        "0.2",
		"ai_max_tokens":         4000,
		"ai_streaming":          true,
		"workspace_name":        "My Workspace",
		"monitoring_enabled":    true,
		"default_member_role":   "member",
	}
}

func settingsToMap(s *db.UserSettings) map[string]interface{} {
	return map[string]interface{}{
		"id":                        s.ID,
		"user_id":                   s.UserID,
		"timezone":                  s.Timezone,
		"default_environment":       s.DefaultEnvironment,
		"default_iac_tool":          s.DefaultIACTool,
		"default_cloud":             s.DefaultCloud,
		"default_namespace":         s.DefaultNamespace,
		"code_font_size":            s.CodeFontSize,
		"avatar_color":              s.AvatarColor,
		"ai_primary_endpoint":       s.AIPrimaryEndpoint,
		"ai_primary_model":          s.AIPrimaryModel,
		"ai_secondary_endpoint":     s.AISecondaryEndpoint,
		"ai_secondary_model":        s.AISecondaryModel,
		"ai_temperature":            s.AITemperature,
		"ai_max_tokens":             s.AIMaxTokens,
		"ai_streaming":              s.AIStreaming,
		"ai_system_prompt_addendum": s.AISystemPromptAddendum,
		"workspace_name":            s.WorkspaceName,
		"require_2fa_team":          s.Require2FATeam,
		"default_member_role":       s.DefaultMemberRole,
		"experience_level":          s.ExperienceLevel,
		"grafana_org_id":            s.GrafanaOrgID,
		"monitoring_enabled":        s.MonitoringEnabled,
		"updated_at":                s.UpdatedAt.Format(time.RFC3339),
	}
}

func strIface(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
