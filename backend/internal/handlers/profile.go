package handlers

import (
	"encoding/json"
	"net/http"

	"meridian/internal/auth"
	"meridian/internal/db"
)

func ProfileGet(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}
	u, err := getUserByID(r.Context(), uid)
	if err != nil {
		writeError(w, 404, "User not found")
		return
	}
	writeJSON(w, 200, userToDict(u))
}

func ProfileUpdate(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		Name        *string `json:"name"`
		AvatarURL   *string `json:"avatar_url"`
		AvatarColor *string `json:"avatar_color"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.Name != nil {
		db.Pool.Exec(r.Context(), `UPDATE users SET name=$1 WHERE id=$2`, *req.Name, uid)
	}
	if req.AvatarURL != nil {
		db.Pool.Exec(r.Context(), `UPDATE users SET avatar_url=$1 WHERE id=$2`, *req.AvatarURL, uid)
	}
	if req.AvatarColor != nil {
		db.Pool.Exec(r.Context(), `UPDATE users SET avatar_color=$1 WHERE id=$2`, *req.AvatarColor, uid)
	}

	u, _ := getUserByID(r.Context(), uid)
	writeJSON(w, 200, userToDict(u))
}

func ProfileUpdateEmail(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		Email string `json:"email"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Check not taken
	var count int
	db.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM users WHERE email=$1 AND id!=$2`, req.Email, uid).Scan(&count)
	if count > 0 {
		writeError(w, 409, "Email already in use")
		return
	}

	db.Pool.Exec(r.Context(), `UPDATE users SET email=$1, email_verified=FALSE WHERE id=$2`, req.Email, uid)
	writeJSON(w, 200, map[string]string{"message": "Email updated"})
}

func ProfileDeleteAccount(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		Password string `json:"password"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	u, err := getUserByID(r.Context(), uid)
	if err != nil {
		writeError(w, 404, "User not found")
		return
	}

	if u.HashedPassword != nil && req.Password != "" {
		if !auth.VerifyPassword(req.Password, *u.HashedPassword) {
			writeError(w, 401, "Incorrect password")
			return
		}
	}

	db.Pool.Exec(r.Context(), `DELETE FROM users WHERE id=$1`, uid)
	clearSessionCookie(w)
	writeJSON(w, 200, map[string]string{"message": "Account deleted"})
}
