package db

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"meridian/internal/config"
)

var Pool *pgxpool.Pool

func Init(ctx context.Context) error {
	if config.DatabaseURL == "" {
		log.Println("DATABASE_URL not set — DB unavailable")
		return nil
	}

	// Normalize URL: asyncpg → standard postgres driver
	dsn := config.DatabaseURL
	dsn = strings.ReplaceAll(dsn, "postgresql+asyncpg://", "postgresql://")
	dsn = strings.ReplaceAll(dsn, "postgres+asyncpg://", "postgresql://")

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("pgxpool.New: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("db ping: %w", err)
	}
	Pool = pool
	if err := migrate(ctx); err != nil {
		log.Printf("DB migration warning: %v", err)
	}
	log.Println("PostgreSQL connected and schema ready")
	return nil
}

func Available() bool { return Pool != nil }

func migrate(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE,
			phone VARCHAR(30) UNIQUE,
			name VARCHAR(255) DEFAULT '',
			avatar_url TEXT,
			avatar_color VARCHAR(20) DEFAULT '#6366f1',
			provider VARCHAR(20) DEFAULT 'email',
			provider_id VARCHAR(255),
			hashed_password VARCHAR(255),
			email_verified BOOLEAN DEFAULT FALSE,
			phone_verified BOOLEAN DEFAULT FALSE,
			plan VARCHAR(20) DEFAULT 'free',
			role VARCHAR(20) DEFAULT 'owner',
			totp_secret VARCHAR(64),
			totp_enabled BOOLEAN DEFAULT FALSE,
			totp_pending_secret VARCHAR(64),
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS otp_codes (
			id SERIAL PRIMARY KEY,
			contact VARCHAR(255) NOT NULL,
			code VARCHAR(6) NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			used BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_otp_codes_contact ON otp_codes(contact)`,
		`CREATE TABLE IF NOT EXISTS clusters (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) UNIQUE NOT NULL,
			environment VARCHAR(20) DEFAULT 'dev',
			connection_type VARCHAR(20) DEFAULT 'token',
			api_url TEXT,
			token TEXT,
			kubeconfig TEXT,
			is_active BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS platform_settings (
			id SERIAL PRIMARY KEY,
			key VARCHAR(100) UNIQUE NOT NULL,
			value TEXT,
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS user_sessions (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			session_token_hash VARCHAR(255) NOT NULL,
			device_info VARCHAR(255) DEFAULT 'Unknown device',
			ip_address VARCHAR(64) DEFAULT '',
			last_active TIMESTAMPTZ DEFAULT NOW(),
			created_at TIMESTAMPTZ DEFAULT NOW(),
			is_revoked BOOLEAN DEFAULT FALSE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_user_sessions_hash ON user_sessions(session_token_hash)`,
		`CREATE TABLE IF NOT EXISTS api_keys (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			name VARCHAR(100) NOT NULL,
			key_prefix VARCHAR(20) NOT NULL,
			key_hash VARCHAR(255) NOT NULL,
			scopes VARCHAR(255) DEFAULT 'read',
			expires_at TIMESTAMPTZ,
			last_used_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			is_revoked BOOLEAN DEFAULT FALSE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id SERIAL PRIMARY KEY,
			user_id INTEGER,
			user_email VARCHAR(255) DEFAULT 'system',
			action VARCHAR(100) NOT NULL,
			resource VARCHAR(255) DEFAULT '',
			ip_address VARCHAR(64) DEFAULT '',
			status VARCHAR(20) DEFAULT 'success',
			details TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
		`CREATE TABLE IF NOT EXISTS team_members (
			id SERIAL PRIMARY KEY,
			workspace_owner_id INTEGER NOT NULL,
			user_id INTEGER,
			email VARCHAR(255) NOT NULL,
			name VARCHAR(255) DEFAULT '',
			role VARCHAR(20) DEFAULT 'member',
			joined_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_team_members_owner ON team_members(workspace_owner_id)`,
		`CREATE TABLE IF NOT EXISTS team_invites (
			id SERIAL PRIMARY KEY,
			workspace_owner_id INTEGER NOT NULL,
			email VARCHAR(255) NOT NULL,
			role VARCHAR(20) DEFAULT 'member',
			token VARCHAR(64) NOT NULL UNIQUE,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			is_cancelled BOOLEAN DEFAULT FALSE
		)`,
		`CREATE TABLE IF NOT EXISTS deploy_configs (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			repo_full_name VARCHAR(255) NOT NULL,
			branch VARCHAR(100) DEFAULT 'main',
			language VARCHAR(50) DEFAULT '',
			framework VARCHAR(100) DEFAULT '',
			ci_tool VARCHAR(50) DEFAULT '',
			registry VARCHAR(50) DEFAULT '',
			secrets_manager VARCHAR(50) DEFAULT '',
			deploy_target VARCHAR(50) DEFAULT '',
			port INTEGER DEFAULT 8080,
			last_verification_status TEXT DEFAULT 'none',
			last_verification_started_at TIMESTAMPTZ,
			last_verification_ended_at TIMESTAMPTZ,
			last_verification_detail TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_deploy_configs_user ON deploy_configs(user_id)`,
		`CREATE TABLE IF NOT EXISTS generate_sessions (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			title VARCHAR(255) DEFAULT '',
			prompt TEXT DEFAULT '',
			tools TEXT DEFAULT '[]',
			context TEXT DEFAULT '[]',
			files_json TEXT DEFAULT '[]',
			meta_json TEXT DEFAULT '{}',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_generate_sessions_user ON generate_sessions(user_id)`,
		`CREATE TABLE IF NOT EXISTS user_settings (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL UNIQUE,
			timezone VARCHAR(64) DEFAULT 'UTC',
			default_environment VARCHAR(20) DEFAULT 'dev',
			default_iac_tool VARCHAR(20) DEFAULT 'terraform',
			default_cloud VARCHAR(20) DEFAULT 'aws',
			default_namespace VARCHAR(100) DEFAULT 'default',
			code_font_size INTEGER DEFAULT 14,
			avatar_color VARCHAR(20) DEFAULT '#6366f1',
			notification_prefs TEXT DEFAULT '{}',
			ai_primary_endpoint TEXT DEFAULT '',
			ai_primary_model VARCHAR(100) DEFAULT 'gemma4',
			ai_secondary_endpoint TEXT DEFAULT '',
			ai_secondary_model VARCHAR(100) DEFAULT 'qwen3:32b',
			ai_temperature VARCHAR(10) DEFAULT '0.2',
			ai_max_tokens INTEGER DEFAULT 4000,
			ai_streaming BOOLEAN DEFAULT TRUE,
			ai_system_prompt_addendum TEXT DEFAULT '',
			workspace_name VARCHAR(100) DEFAULT 'My Workspace',
			require_2fa_team BOOLEAN DEFAULT FALSE,
			default_member_role VARCHAR(20) DEFAULT 'member',
			experience_level VARCHAR(20),
			secrets_json TEXT DEFAULT '[]',
			grafana_org_id INTEGER,
			monitoring_enabled BOOLEAN DEFAULT TRUE,
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS user_secrets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			value_encrypted TEXT NOT NULL,
			secret_type TEXT NOT NULL DEFAULT 'other',
			description TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(user_id, name)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_user_secrets_user ON user_secrets(user_id)`,
		`CREATE TABLE IF NOT EXISTS agent_tokens (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id INTEGER NOT NULL,
			cluster_name TEXT NOT NULL,
			token TEXT NOT NULL UNIQUE,
			token_prefix TEXT NOT NULL,
			is_active BOOLEAN DEFAULT TRUE,
			last_seen_at TIMESTAMPTZ,
			agent_version TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(user_id, cluster_name)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_tokens_user ON agent_tokens(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_tokens_token ON agent_tokens(token)`,
		`CREATE TABLE IF NOT EXISTS alert_channels (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id INTEGER NOT NULL,
			channel_type TEXT NOT NULL,
			name TEXT NOT NULL,
			config_encrypted TEXT NOT NULL,
			is_active BOOLEAN DEFAULT TRUE,
			alert_on TEXT DEFAULT '["critical","high"]',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_alert_channels_user ON alert_channels(user_id)`,
		`CREATE TABLE IF NOT EXISTS alert_history (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			incident_id TEXT,
			channel_id UUID,
			channel_type TEXT NOT NULL,
			sent_at TIMESTAMPTZ DEFAULT NOW(),
			status TEXT DEFAULT 'sent',
			error_text TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS diagnose_prs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			session_id TEXT NOT NULL,
			repo_full_name TEXT NOT NULL,
			pr_number INTEGER,
			pr_url TEXT,
			pr_branch TEXT,
			base_branch TEXT DEFAULT 'main',
			pr_state TEXT DEFAULT 'open',
			pr_created_at TIMESTAMPTZ DEFAULT NOW(),
			pr_merged_at TIMESTAMPTZ,
			pr_closed_at TIMESTAMPTZ,
			last_checked_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS metric_history (
			id BIGSERIAL PRIMARY KEY,
			cluster_name TEXT NOT NULL,
			resource_name TEXT NOT NULL,
			namespace TEXT NOT NULL DEFAULT 'default',
			metric_name TEXT NOT NULL,
			value DOUBLE PRECISION NOT NULL,
			recorded_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_metric_history_lookup ON metric_history(cluster_name, resource_name, metric_name, recorded_at)`,
		// Incremental column additions (idempotent)
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_secret VARCHAR(64)`,
		`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS experience_level VARCHAR(20)`,
		`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS secrets_json TEXT DEFAULT '[]'`,
		`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS grafana_org_id INTEGER`,
		`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT TRUE`,
	}

	for _, stmt := range stmts {
		if _, err := Pool.Exec(ctx, stmt); err != nil {
			log.Printf("migration warn: %v | stmt: %.80s", err, stmt)
		}
	}
	return nil
}
