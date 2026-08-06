package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"meridian/internal/config"
	"meridian/internal/db"
)

func TeamList(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !db.Available() {
		writeJSON(w, 200, map[string]interface{}{"members": []interface{}{}})
		return
	}

	rows, _ := db.Pool.Query(r.Context(),
		`SELECT id, user_id, email, name, role, joined_at FROM team_members WHERE workspace_owner_id=$1 ORDER BY joined_at`,
		uid,
	)
	defer rows.Close()

	members := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var userID *int
		var email, name, role string
		var joinedAt time.Time
		rows.Scan(&id, &userID, &email, &name, &role, &joinedAt)
		members = append(members, map[string]interface{}{
			"id":        id,
			"user_id":   userID,
			"email":     email,
			"name":      name,
			"role":      role,
			"joined_at": joinedAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, 200, map[string]interface{}{"members": members})
}

func TeamInvite(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Role == "" {
		req.Role = "member"
	}

	token := genID()
	expires := time.Now().UTC().Add(7 * 24 * time.Hour)

	db.Pool.Exec(r.Context(),
		`INSERT INTO team_invites (workspace_owner_id, email, role, token, expires_at)
		 VALUES ($1,$2,$3,$4,$5)`,
		uid, req.Email, req.Role, token, expires,
	)

	// Send invite email
	if config.ResendAPIKey != "" {
		sendInviteEmail(r.Context(), req.Email, token)
	}

	writeJSON(w, 201, map[string]string{"message": "Invite sent", "token": token})
}

func sendInviteEmail(ctx interface{ Done() <-chan struct{} }, email, token string) {
	inviteURL := fmt.Sprintf("%s/invite?token=%s", config.FrontendURL, token)
	body := map[string]interface{}{
		"from":    "Meridian <noreply@meridian.dev>",
		"to":      []string{email},
		"subject": "You're invited to join Meridian",
		"html":    fmt.Sprintf(`<p>You've been invited. <a href="%s">Accept invitation</a></p>`, inviteURL),
	}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+config.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")
	http.DefaultClient.Do(req)
}

func TeamAcceptInvite(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if !requireDB(w) {
		return
	}

	var id, ownerID int
	var email, role string
	var expiresAt time.Time
	err := db.Pool.QueryRow(r.Context(),
		`SELECT id, workspace_owner_id, email, role, expires_at FROM team_invites
		 WHERE token=$1 AND is_cancelled=FALSE`,
		req.Token,
	).Scan(&id, &ownerID, &email, &role, &expiresAt)

	if err != nil || time.Now().UTC().After(expiresAt) {
		writeError(w, 400, "Invalid or expired invite token")
		return
	}

	uid, _ := getUserID(r)
	db.Pool.Exec(r.Context(),
		`INSERT INTO team_members (workspace_owner_id, user_id, email, role) VALUES ($1,$2,$3,$4)
		 ON CONFLICT DO NOTHING`,
		ownerID, uid, email, role,
	)
	db.Pool.Exec(r.Context(), `UPDATE team_invites SET is_cancelled=TRUE WHERE id=$1`, id)
	writeJSON(w, 200, map[string]string{"message": "Joined workspace"})
}

func TeamRemoveMember(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	memberID := chi.URLParam(r, "id")
	if db.Available() {
		db.Pool.Exec(r.Context(),
			`DELETE FROM team_members WHERE id=$1 AND workspace_owner_id=$2`,
			memberID, uid,
		)
	}
	w.WriteHeader(204)
}

func TeamUpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	memberID := chi.URLParam(r, "id")
	var req struct {
		Role string `json:"role"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if db.Available() {
		db.Pool.Exec(r.Context(),
			`UPDATE team_members SET role=$1 WHERE id=$2 AND workspace_owner_id=$3`,
			req.Role, memberID, uid,
		)
	}
	writeJSON(w, 200, map[string]string{"message": "Role updated"})
}
