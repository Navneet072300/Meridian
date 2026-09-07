# Meridian

An early-access launch platform for founders and coding agents. Upload a project
folder/ZIP, import a public GitHub repository, or connect the local MCP bridge.
Review source checks, launch a preview and publish a versioned release.

Stack: Go/chi API, PostgreSQL, React/TypeScript/Vite frontend, and a separate Go
worker using an isolated BuildKit daemon, OCI registry and managed Kubernetes.
Deployment jobs live in PostgreSQL; Redis supports the legacy cache.

## Local setup

```sh
cp backend/.env.example backend/.env
# Set random JWT_SECRET and ENCRYPTION_KEY values; see the setup below.
docker compose up --build
```

Open http://localhost:3000. Email sign-in does not require GitHub. In development
without an email-provider key, codes appear in backend logs. Uploads work without
a worker; deployment requires configured hosting infrastructure.

For source development run `go run .` in backend and `npm ci && npm run dev` in
frontend. PostgreSQL is required for accounts and projects.

## Release scope and operations

This change implements an executable early-access launch path. The broader
architecture is a target design, not a list of completed features. Public launch
still requires the infrastructure and product work listed below.

## Implemented

- Email-code signup/login. GitHub is optional. Session revocation, expiring JWTs,
  origin checks, limited code attempts, fail-closed encryption.
- Account-owned projects; immutable source ZIP snapshots and launch plans;
  ZIP/folder upload; public GitHub archive import.
- Detection for npm/Node, Vite's default static build, root Go binaries,
  FastAPI `main:app`, static HTML, and custom Dockerfiles. Other Python entrypoints,
  monorepos and unsupported stacks return an actionable blocker.
- Encrypted runtime variables, saved configuration snapshots, PostgreSQL jobs,
  bounded deployment events/build output, preview and production routes,
  queued-job cancellation and restoration of a healthy image/configuration.
- Separate BuildKit/Kubernetes worker, immutable image digests, non-root
  workloads, required sandbox RuntimeClass, resource quotas and NetworkPolicies.
  Traffic switches only after the new app passes HTTP readiness.
- Local stdio MCP bridge: seven tools for listing/creating projects, uploading
  the configured workspace, inspecting plans/events, setting variables and
  deploying previews. Keys expire after 30 days and are revocable. Production
  publishing requires dashboard confirmation; agent keys cannot publish it.
- Global cluster/PAT/placeholder features disabled by default. Legacy UI requires
  `VITE_ENABLE_LEGACY=true`; legacy API requires
  `ENABLE_LEGACY_SINGLE_TENANT=true` on a private operator instance.

## Run the application

Copy `backend/.env.example` to `backend/.env`. Set JWT_SECRET and ENCRYPTION_KEY
to independent random values (`openssl rand -hex 32`). Run
`docker compose up --build` and open http://localhost:3000.

Compose supplies PostgreSQL/Redis and a persistent source volume. In development
without RESEND_API_KEY, sign-in codes appear in backend logs. Production requires
email delivery and `EMAIL_FROM` on a verified Resend sender domain. Set
`BETA_ALLOWED_EMAILS` to a comma-separated list of invited email addresses.
Production refuses unrestricted signup; the allowlist is checked when sending
and verifying codes. This is an admission control, not account/session revocation.

For source development run `go run .` inside backend, then `npm ci` and
`npm run dev` inside frontend. `go run ./...` no longer applies: there are API and
worker executables. Config loads `.env` before evaluating settings. PostgreSQL is
required for real accounts/projects; JSON is not an account database fallback.

Upload the `examples/hello-web` folder to exercise source inspection. Without a
connected worker, Deploy is unavailable; uploads do not fabricate a live URL.

## Connect hosting

Prepare these in your chosen hosting account:

1. A dedicated managed Kubernetes runtime cluster, working ingress controller,
   NetworkPolicy-enforcing CNI and an installed sandbox RuntimeClass. Setting
   RUNTIME_CLASS alone does not install gVisor/Kata or establish isolation.
2. A separate isolated BuildKit daemon with mutual TLS, no insecure/host-network
   entitlements and egress restrictions blocking internal control-plane services,
   metadata endpoints and other tenants. Do not mount Docker sockets in the API.
3. Private OCI registry: push credentials for worker, read-only pull credentials
   for runtime. Pin/review the worker's BUILDKIT_IMAGE before production.
4. Wildcard DNS and TLS for the application domain. Use a different registrable
   domain for untrusted customer apps than for the Meridian dashboard.
5. Managed PostgreSQL backups and backed-up source storage. This beta uses a
   shared filesystem volume; horizontal scaling requires shared storage or a
   future object-storage adapter.

Apply `deploy/worker-rbac.yaml` only in the managed runtime cluster. This role
manages app namespaces/resources and is not the future customer BYOC agent role.
Label the ingress-controller namespace `meridian.ingress=true`. Generated
policies allow that namespace, same-project pods, cluster DNS and public IPv4
egress; they block private IPv4/link-local ranges. Configure explicit policy
exceptions for private database endpoints and verify your CNI enforces them.

Create registry-pull and wildcard-TLS Secrets in `meridian-system`. The worker
copies only its configured Secrets into project namespaces. Copies refresh on
deployment; arrange continuous TLS renewal/mirroring for a public service.

Create `.env.worker` at the repo root:

```dotenv
APP_DOMAIN=apps.your-customer-domain.example
IMAGE_REPOSITORY=registry.example/meridian/apps
IMAGE_PULL_SECRET=app-registry-pull
BUILDKIT_HOST=tcp://builder.example:1234
INGRESS_CLASS=your-installed-ingress-class
RUNTIME_CLASS=your-installed-sandbox-runtime
APP_TLS_SECRET=app-wildcard-tls
PLATFORM_NAMESPACE=meridian-system
```

Create an operator credentials directory readable by UID 10001 containing
`kubeconfig`, `buildkit/ca.pem`, `buildkit/cert.pem`, `buildkit/key.pem`, and
`registry/config.json` (Docker registry authentication). Use embedded CA/auth
data: cloud exec plugins are not bundled. Arrange credential renewal.

Set MERIDIAN_WORKER_CREDENTIALS to that absolute directory, then run:

```sh
docker compose -f docker-compose.yml -f docker-compose.worker.yml up --build
```

Compose is a development/operator reference, not HA production configuration.
Replace its default database credentials and expose only the frontend/reverse
proxy over HTTPS. APP_ENV=production enforces DB/signing/encryption settings,
HTTPS FRONTEND_URL, email-provider/sender configuration, an invitation allowlist
and customer-route TLS. The socket-IP auth throttle assumes direct access or
one trusted reverse proxy; users behind a proxy share that quota. Add trusted
proxy-aware edge rate limits before expanding beyond the invited beta.

## Behavior and limits

- One queue owner via PostgreSQL advisory lock, one active job per environment.
  Restart requeues interrupted jobs, reusing saved digests. Persistence failure
  after routing stops the worker so replay reconciles the same release.
- Each project has stable preview and production URLs. Historical deployment
  links therefore open the current release, not a frozen preview of each version.
- Readiness expects HTTP 200–399 at `/`, with a four-minute rollout deadline;
  total job deadline is twenty minutes. This verifies Kubernetes readiness,
  not public DNS/TLS reachability or business behavior. Check the actual URL.
- One web service/project, one replica/environment, 100m CPU/128Mi requested,
  1 CPU/512Mi limited. No autoscaling, persistent app disk or HA guarantee.
- Runtime variables currently apply to both preview and production jobs. Use
  separate projects for separate credentials until per-environment settings ship.
  Restores use saved variables. They never reverse database migrations.
- Limits: ZIP 32 MB, expanded 128 MB, 5,000 files; two concurrent source imports;
  20 projects/account and 30 uploads/project. No self-service deletion/retention
  or complete metering/abuse controls yet; do not enable unrestricted signups.
- Build recipe detection is deterministic and may request a Dockerfile. Secret
  discovery reads `.env.example` names; it cannot discover every app dependency.

## MCP connection

Run `npm ci` in `mcp/`. Create a key in the Coding agent tab and use its connection
example with absolute paths to `mcp/server.mjs` and MERIDIAN_WORKSPACE. Node 20.17+
is required; CI uses Node 22. The bridge sends only the configured workspace,
rejecting outside paths, symlinks and common secret files. Credentials are
environment variables, not command-line arguments. It is a local stdio bridge;
remote MCP OAuth, app listings and one-click installs have not shipped.

## Tests and live acceptance

Run `go test ./...` and `go vet ./...` in backend. For integration and race tests:

```sh
TEST_DATABASE_URL='postgres://user:password@localhost:5432/testdb?sslmode=disable' go test -race ./...
```

Use a disposable database; tests create/drop uniquely named schemas. In frontend
run `npm run build` and `npx eslint src/pages/LaunchPage.tsx src/pages/EmailLoginPage.tsx src/pages/ReleaseLandingPage.tsx`.
In mcp run `npm ci` and `npm test`.

Tests exercise owner isolation, encryption failure, session expiry/revocation,
origin checks, archive corruption/traversal/links, idempotency, offline behavior,
MCP handshake/uploads and readiness-gated routing using the Kubernetes test client.

Before inviting users, use the real builder/registry/cluster to launch the
example, verify public HTTPS, deploy a failing version, confirm the old route
still works, restore a healthy release, restart a worker mid-job, and restore
DB/source backups. Record results for the actual provider.

## Pending broader product features

Private GitHub App installation/webhooks and push deployments; managed database
provisioning/backups/migrations; independent environment secrets; BYOC agent;
customer custom domains; team RBAC; runtime logs/continuous monitoring; AI
diagnosis/fix PRs; billing/usage/abuse enforcement; retention; image scanning and
signatures; remote MCP OAuth; and a verified production hosting deployment.
The new UI does not present these as implemented.

Protocol references: [BuildKit CLI](https://github.com/moby/buildkit/blob/master/docs/reference/buildctl.md),
[MCP TypeScript SDK v1](https://ts.sdk.modelcontextprotocol.io/server).

## Local verification record — 2026-09-07

- Passed backend race tests with a disposable PostgreSQL 16 database and `go vet`.
- Passed frontend TypeScript/production build and focused lint for the release
  pages, layout, sidebar and authentication store.
- Passed MCP protocol/workspace upload tests. Frontend dependency patches cleared
  the seven reported high-severity advisories; npm reported zero vulnerabilities
  after updating the lockfile. This is not a comprehensive security audit.
- Built API, worker and frontend container images locally. Confirmed the bundled
  BuildKit client supports the configured mutual-TLS flags and certificate names.
- Browser smoke-tested email-code login, project creation, folder and ZIP imports,
  source revision checks, write-only variable saving and sign-out. Confirmed
  deployment buttons remain disabled when the hosting worker is offline.
- Not tested against a real deployment builder/registry/runtime cluster or public
  HTTPS endpoint. Live acceptance above remains a release blocker.
