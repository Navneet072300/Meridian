package services

import (
	"context"
	"log"

	"meridian/internal/db"
)

func AuditLog(ctx context.Context, userID *int, userEmail, action, resource, ip, status string, details *string) {
	if !db.Available() {
		return
	}
	email := userEmail
	if email == "" {
		email = "system"
	}
	st := status
	if st == "" {
		st = "success"
	}
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO audit_logs (user_id, user_email, action, resource, ip_address, status, details)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		userID, email, action, resource, ip, st, details,
	)
	if err != nil {
		log.Printf("audit log error: %v", err)
	}
}
