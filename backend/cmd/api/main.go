// Command api runs the Neuratop HTTP server.
package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/neuratop/backend/internal/auth"
	"github.com/neuratop/backend/internal/billing"
	"github.com/neuratop/backend/internal/folder"
	"github.com/neuratop/backend/internal/generation"
	"github.com/neuratop/backend/internal/platform/config"
	"github.com/neuratop/backend/internal/platform/db"
	"github.com/neuratop/backend/internal/platform/httpserver"
	"github.com/neuratop/backend/internal/profile"
	"github.com/neuratop/backend/internal/puzzle"
	"github.com/neuratop/backend/internal/webui"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	accessIssuer := httpserver.NewTokenIssuer(cfg.JWTAccessSecret, cfg.AccessTokenTTL)
	authMiddleware := httpserver.RequireAuth(accessIssuer)

	root, api := httpserver.NewRouter(cfg.CORSAllowedOrigin)

	authDeps := auth.NewDeps(pool, cfg, accessIssuer)
	auth.RegisterRoutes(api, authMiddleware, authDeps)

	generationDeps := generation.NewDeps(pool)
	generation.RegisterRoutes(api, authMiddleware, generationDeps)

	puzzleDeps := puzzle.NewDeps(pool, generationDeps.Fixtures())
	puzzle.RegisterRoutes(api, authMiddleware, puzzleDeps)

	folderDeps := folder.NewDeps(pool)
	folder.RegisterRoutes(api, authMiddleware, folderDeps)

	profileDeps := profile.NewDeps(pool)
	profile.RegisterRoutes(api, authMiddleware, profileDeps)

	billingDeps := billing.NewDeps(pool)
	billing.RegisterRoutes(api, authMiddleware, billingDeps)

	// Only present when built with `-tags webui` (see internal/webui and
	// Dockerfile's frontend build stage) — lets one Render service serve
	// both the API and the SPA. Absent in local dev (`go run ./cmd/api`),
	// which behaves exactly as before this existed.
	if distFS, ok := webui.DistFS(); ok {
		root.Handle("/*", httpserver.NewSPAHandler(distFS))
		slog.Info("serving embedded frontend build")
	}

	srv := &http.Server{
		Addr:              ":" + cfg.HTTPPort,
		Handler:           root,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("http server listening", "port", cfg.HTTPPort, "env", cfg.AppEnv)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}
}
