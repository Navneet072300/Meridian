CREATE TABLE IF NOT EXISTS launch_projects (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id INTEGER NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
 env_encrypted TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launch_projects_owner ON launch_projects(user_id);
CREATE TABLE IF NOT EXISTS launch_revisions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES launch_projects(id),
 source_key TEXT NOT NULL,
 plan JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS launch_deployments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES launch_projects(id),
 revision_id UUID NOT NULL REFERENCES launch_revisions(id),
 environment TEXT NOT NULL CHECK (environment IN ('preview','production')),
 status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','building','deploying','healthy','failed','cancelled')),
 env_encrypted TEXT NOT NULL,
 port INTEGER NOT NULL CHECK(port BETWEEN 1024 AND 65535),
 image TEXT NOT NULL DEFAULT '',
 url TEXT NOT NULL DEFAULT '',
 message TEXT NOT NULL DEFAULT '',
 idempotency_key TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(project_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS launch_one_active ON launch_deployments(project_id,environment) WHERE status IN ('queued','building','deploying');
CREATE INDEX IF NOT EXISTS launch_jobs ON launch_deployments(created_at) WHERE status='queued';
CREATE TABLE IF NOT EXISTS launch_events (
 id BIGSERIAL PRIMARY KEY,
 deployment_id UUID NOT NULL REFERENCES launch_deployments(id),
 message TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launch_event_cursor ON launch_events(deployment_id,id);
CREATE TABLE IF NOT EXISTS launch_agent_keys (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id INTEGER NOT NULL REFERENCES users(id),
 key_hash TEXT NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '30 days'
);
CREATE TABLE IF NOT EXISTS launch_worker_health (
 name TEXT PRIMARY KEY,
 last_seen TIMESTAMPTZ NOT NULL
);
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
