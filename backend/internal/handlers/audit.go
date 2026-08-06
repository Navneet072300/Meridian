package handlers

import (
	"net/http"
	"time"

	"meridian/internal/db"
)

func AuditList(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !db.Available() {
		writeJSON(w, 200, map[string]interface{}{"logs": []interface{}{}})
		return
	}

	limit := 100
	rows, err := db.Pool.Query(r.Context(),
		`SELECT id, user_email, action, resource, ip_address, status, details, created_at
		 FROM audit_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
		uid, limit,
	)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"logs": []interface{}{}})
		return
	}
	defer rows.Close()

	logs := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var email, action, resource, ip, status string
		var details *string
		var createdAt time.Time
		rows.Scan(&id, &email, &action, &resource, &ip, &status, &details, &createdAt)
		logs = append(logs, map[string]interface{}{
			"id":         id,
			"user_email": email,
			"action":     action,
			"resource":   resource,
			"ip_address": ip,
			"status":     status,
			"details":    details,
			"created_at": createdAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, 200, map[string]interface{}{"logs": logs})
}
