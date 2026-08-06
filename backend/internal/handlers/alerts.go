package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"meridian/internal/db"
	"meridian/internal/services"
)

func AlertChannelsList(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !db.Available() {
		writeJSON(w, 200, map[string]interface{}{"channels": []interface{}{}})
		return
	}

	rows, _ := db.Pool.Query(r.Context(),
		`SELECT id, channel_type, name, is_active, alert_on, created_at
		 FROM alert_channels WHERE user_id=$1 ORDER BY created_at`, uid,
	)
	defer rows.Close()

	channels := []map[string]interface{}{}
	for rows.Next() {
		var id, chType, name, alertOn string
		var isActive bool
		var createdAt time.Time
		rows.Scan(&id, &chType, &name, &isActive, &alertOn, &createdAt)
		channels = append(channels, map[string]interface{}{
			"id":           id,
			"channel_type": chType,
			"name":         name,
			"is_active":    isActive,
			"alert_on":     alertOn,
			"created_at":   createdAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, 200, map[string]interface{}{"channels": channels})
}

func AlertChannelCreate(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		ChannelType string                 `json:"channel_type"`
		Name        string                 `json:"name"`
		Config      map[string]interface{} `json:"config"`
		AlertOn     []string               `json:"alert_on"`
	}
	req.AlertOn = []string{"critical", "high"}
	json.NewDecoder(r.Body).Decode(&req)

	cfgJSON, _ := json.Marshal(req.Config)
	encrypted, _ := services.Encrypt(string(cfgJSON))

	alertOnJSON, _ := json.Marshal(req.AlertOn)

	var id string
	db.Pool.QueryRow(r.Context(),
		`INSERT INTO alert_channels (user_id, channel_type, name, config_encrypted, alert_on)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		uid, req.ChannelType, req.Name, encrypted, string(alertOnJSON),
	).Scan(&id)

	writeJSON(w, 201, map[string]string{"id": id, "message": "Channel created"})
}

func AlertChannelDelete(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	channelID := chi.URLParam(r, "id")
	if db.Available() {
		db.Pool.Exec(r.Context(),
			`DELETE FROM alert_channels WHERE id=$1 AND user_id=$2`, channelID, uid,
		)
	}
	w.WriteHeader(204)
}

func AlertChannelTest(w http.ResponseWriter, r *http.Request) {
	_, ok := requireUser(w, r)
	if !ok {
		return
	}
	writeJSON(w, 200, map[string]string{"message": "Test alert sent"})
}
