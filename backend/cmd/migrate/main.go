// Command migrate applies pending SQL migrations from backend/migrations.
package main

import (
	"context"
	"log"

	"github.com/neuratop/backend/internal/platform/config"
	"github.com/neuratop/backend/internal/platform/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, "migrations"); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("migrations up to date")
}
