package launch

import (
	"context"
	_ "embed"
	"meridian/internal/db"
)

//go:embed schema.sql
var schema string

// Changes are additive. A transaction prevents partially installed launch tables.
func Migrate(ctx context.Context) error {
	tx, e := db.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(71423820)`); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, schema); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func Event(ctx context.Context, id, msg string) error {
	_, e := db.Pool.Exec(ctx, `INSERT INTO launch_events(deployment_id,message) VALUES($1,$2)`, id, msg)
	return e
}
