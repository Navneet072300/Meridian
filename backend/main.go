package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"meridian/internal/config"
	"meridian/internal/db"
	"meridian/internal/handlers"
	"meridian/internal/launch"
	"meridian/internal/services"
	"meridian/internal/workers"
)

func main() {
	godotenv.Load()
	if err := config.ValidateProduction(); err != nil {
		log.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Init DB
	if err := db.Init(ctx); err != nil {
		log.Fatalf("DB init failed: %v", err)
	}
	if db.Available() {
		if err := launch.Migrate(ctx); err != nil {
			log.Fatalf("Launch migration failed: %v", err)
		}
	}

	// Init Redis
	if err := services.InitRedis(ctx); err != nil {
		log.Printf("Redis init warning: %v", err)
	}

	// Start cluster monitor
	if os.Getenv("ENABLE_LEGACY_SINGLE_TENANT") == "true" {
		workers.Start(ctx)
	}

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(120 * time.Second))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{config.FrontendURL, "http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "Cookie", "Idempotency-Key"},
		ExposedHeaders:   []string{"Set-Cookie"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check (no /api prefix)
	r.Get("/health", handlers.Health)

	// All API routes
	r.Route("/api", func(r chi.Router) {
		r.Use(handlers.ReleaseAccess)
		r.Route("/launch", func(r chi.Router) {
			r.Use(handlers.LaunchAccess)
			r.Get("/status", handlers.LaunchStatus)
			r.Get("/projects", handlers.LaunchProjects)
			r.Post("/projects", handlers.LaunchCreateProject)
			r.Get("/projects/{project}", handlers.LaunchProject)
			r.Post("/projects/{project}/sources", handlers.LaunchUpload)
			r.Post("/projects/{project}/github", handlers.LaunchGitHub)
			r.Put("/projects/{project}/environment", handlers.LaunchEnvironment)
			r.Post("/projects/{project}/deployments", handlers.LaunchDeploy)
			r.Get("/projects/{project}/deployments/{deployment}/events", handlers.LaunchEvents)
			r.Post("/projects/{project}/deployments/{deployment}/cancel", handlers.LaunchCancel)
			r.Get("/agent-keys", handlers.LaunchAgentKeys)
			r.Post("/agent-keys", handlers.LaunchAgentKeys)
			r.Delete("/agent-keys", handlers.LaunchAgentKeys)
		})
		// ── Auth ───────────────────────────────────────────────────────────────
		r.Post("/auth/signup", handlers.Signup)
		r.Post("/auth/login", handlers.Login)
		r.Post("/auth/otp/send", handlers.OTPSend)
		r.Post("/auth/otp/verify", handlers.OTPVerify)
		r.Get("/auth/google", handlers.GoogleAuth)
		r.Get("/auth/google/callback", handlers.GoogleCallback)
		r.Get("/auth/github", handlers.GitHubAuth)
		r.Get("/auth/github/callback", handlers.GitHubCallback)
		r.Get("/auth/gitlab", handlers.GitLabAuth)
		r.Get("/auth/gitlab/callback", handlers.GitLabCallback)
		r.Get("/auth/me", handlers.Me)
		r.Post("/auth/logout", handlers.Logout)
		r.Post("/auth/change-password", handlers.ChangePassword)
		r.Get("/auth/sessions", handlers.ListSessions)
		r.Delete("/auth/sessions/{session_id}", handlers.RevokeSession)
		r.Delete("/auth/sessions", handlers.RevokeAllSessions)
		r.Get("/auth/2fa/setup", handlers.Setup2FA)
		r.Post("/auth/2fa/enable", handlers.Enable2FA)
		r.Post("/auth/2fa/disable", handlers.Disable2FA)
		r.Get("/auth/api-keys", handlers.ListAPIKeys)
		r.Post("/auth/api-keys", handlers.CreateAPIKey)
		r.Delete("/auth/api-keys/{key_id}", handlers.RevokeAPIKey)

		// ── Kubernetes ────────────────────────────────────────────────────────
		r.Get("/k8s/health", handlers.K8sHealth)
		r.Get("/k8s/clusters", handlers.K8sClusters)
		r.Get("/k8s/namespaces", handlers.K8sNamespaces)
		r.Get("/k8s/pods", handlers.K8sPods)
		r.Get("/k8s/pod/logs", handlers.K8sPodLogs)
		r.Get("/k8s/pod/events", handlers.K8sPodEvents)
		r.Get("/k8s/nodes", handlers.K8sNodes)
		r.Get("/k8s/events", handlers.K8sEvents)
		r.Get("/k8s/overview", handlers.K8sOverview)
		r.Get("/k8s/describe", handlers.K8sDescribe)
		r.Get("/k8s/resources", handlers.K8sAllResources)
		r.Get("/k8s/node-metrics", handlers.K8sNodeMetrics)
		r.Post("/k8s/kubectl", handlers.K8sKubectl)

		// ── Generate ──────────────────────────────────────────────────────────
		r.Post("/generate", handlers.Generate)
		r.Post("/generate/sessions", handlers.SaveGenerateSession)
		r.Get("/generate/sessions", handlers.ListGenerateSessions)
		r.Delete("/generate/sessions/{session_id}", handlers.DeleteGenerateSession)

		// ── Diagnose ──────────────────────────────────────────────────────────
		r.Post("/diagnose/start", handlers.DiagnoseStart)
		r.Post("/diagnose/analyze", handlers.DiagnoseAnalyze)
		r.Post("/diagnose/chat", handlers.DiagnoseChat)
		r.Get("/diagnose/session", handlers.DiagnoseGetSession)

		// ── Design ────────────────────────────────────────────────────────────
		r.Post("/design/generate", handlers.DesignGenerate)

		// ── GitHub ────────────────────────────────────────────────────────────
		r.Get("/github/repos", handlers.GitHubListRepos)
		r.Get("/github/branches", handlers.GitHubListBranches)
		r.Get("/github/status", handlers.GitHubStatus)
		r.Post("/github/pat", handlers.GitHubSavePAT)

		// ── Agent ─────────────────────────────────────────────────────────────
		r.Post("/agent/chat", handlers.AgentChat)
		r.Post("/agent/message", handlers.AgentChat)

		// ── Settings ──────────────────────────────────────────────────────────
		r.Get("/settings/clusters", handlers.SettingsListClusters)
		r.Post("/settings/clusters", handlers.SettingsCreateCluster)
		r.Put("/settings/clusters/{name}", handlers.SettingsUpdateCluster)
		r.Delete("/settings/clusters/{name}", handlers.SettingsDeleteCluster)
		r.Post("/settings/clusters/{name}/activate", handlers.SettingsSetActiveCluster)
		r.Post("/settings/clusters/{name}/test", handlers.SettingsTestCluster)
		r.Get("/settings/user", handlers.SettingsGetUser)
		r.Put("/settings/user", handlers.SettingsUpdateUser)
		r.Patch("/settings/user", handlers.SettingsUpdateUser)
		r.Get("/settings/secrets", handlers.SettingsListSecrets)
		r.Post("/settings/secrets", handlers.SettingsCreateSecret)
		r.Delete("/settings/secrets/{id}", handlers.SettingsDeleteSecret)

		// ── Platform ──────────────────────────────────────────────────────────
		r.Get("/platform", handlers.PlatformGet)
		r.Post("/platform", handlers.PlatformSave)
		r.Put("/platform", handlers.PlatformSave)
		r.Get("/platform/config", handlers.PlatformConfig)

		// ── Profile ───────────────────────────────────────────────────────────
		r.Get("/profile", handlers.ProfileGet)
		r.Put("/profile", handlers.ProfileUpdate)
		r.Patch("/profile", handlers.ProfileUpdate)
		r.Put("/profile/email", handlers.ProfileUpdateEmail)
		r.Delete("/profile", handlers.ProfileDeleteAccount)

		// ── Audit ─────────────────────────────────────────────────────────────
		r.Get("/audit", handlers.AuditList)

		// ── Team ──────────────────────────────────────────────────────────────
		r.Get("/team", handlers.TeamList)
		r.Post("/team/invite", handlers.TeamInvite)
		r.Post("/team/accept", handlers.TeamAcceptInvite)
		r.Delete("/team/{id}", handlers.TeamRemoveMember)
		r.Patch("/team/{id}/role", handlers.TeamUpdateMemberRole)

		// ── Incidents ─────────────────────────────────────────────────────────
		r.Get("/incidents", handlers.IncidentsList)
		r.Get("/incidents/{id}", handlers.IncidentGet)
		r.Post("/incidents/{id}/acknowledge", handlers.IncidentAcknowledge)
		r.Post("/incidents/{id}/snooze", handlers.IncidentSnooze)
		r.Post("/incidents/{id}/resolve", handlers.IncidentResolve)

		// ── Alerts / channels ─────────────────────────────────────────────────
		r.Get("/alert-channels", handlers.AlertChannelsList)
		r.Post("/alert-channels", handlers.AlertChannelCreate)
		r.Delete("/alert-channels/{id}", handlers.AlertChannelDelete)
		r.Post("/alert-channels/{id}/test", handlers.AlertChannelTest)

		// ── Monitoring ────────────────────────────────────────────────────────
		r.Get("/monitoring/overview", handlers.MonitoringOverview)
		r.Get("/monitoring/metrics", handlers.MonitoringMetrics)

		// ── Deploy (pipeline config) ──────────────────────────────────────────
		r.Get("/deploy", handlers.DeployList)
		r.Post("/deploy", handlers.DeployCreate)
		r.Post("/deploy/generate", handlers.DeployGenerate)
		r.Delete("/deploy/{id}", handlers.DeployDelete)

		// ── Deployments (running workloads) ───────────────────────────────────
		r.Get("/deployments", handlers.DeploymentsList)

		// ── Subscription ──────────────────────────────────────────────────────
		r.Get("/subscription", handlers.SubscriptionGet)
		r.Post("/subscription/upgrade", handlers.SubscriptionUpgrade)

		// ── Support ───────────────────────────────────────────────────────────
		r.Post("/support/ticket", handlers.SupportTicketCreate)

		// ── Implement ─────────────────────────────────────────────────────────
		r.Post("/implement", handlers.ImplementGenerate)

		// ── Vault ─────────────────────────────────────────────────────────────
		r.Get("/vault/status", handlers.VaultStatus)
		r.Get("/vault/secrets", handlers.VaultSecrets)

		// ── Agent management ──────────────────────────────────────────────────
		r.Get("/agent-mgmt/tokens", handlers.AgentTokenList)
		r.Post("/agent-mgmt/tokens", handlers.AgentTokenCreate)
		r.Delete("/agent-mgmt/tokens/{id}", handlers.AgentTokenRevoke)

		// ── Agent metrics (Helm agent push) ───────────────────────────────────
		r.Post("/agent-metrics", handlers.AgentMetricsPush)
		r.Get("/agent-metrics/{cluster}", handlers.AgentMetricsGet)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	addr := ":" + port

	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 130 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Meridian Go backend listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down...")
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	srv.Shutdown(shutCtx)

	// Force-reference config to keep import used in config.go
	_ = config.DatabaseURL
}
