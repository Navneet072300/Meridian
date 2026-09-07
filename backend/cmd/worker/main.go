package main

import (
	"context"
	"log"
	"meridian/internal/config"
	"meridian/internal/db"
	"meridian/internal/launch"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	if e := config.ValidateProduction(); e != nil {
		log.Fatal(e)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if e := db.Init(ctx); e != nil {
		log.Fatal(e)
	}
	if !db.Available() {
		log.Fatal("DATABASE_URL is required")
	}
	if e := launch.Migrate(ctx); e != nil {
		log.Fatal(e)
	}
	runtime, e := launch.RuntimeFromEnv()
	if e != nil {
		log.Fatal(e)
	}
	if e = runtime.Run(ctx); e != nil && ctx.Err() == nil {
		log.Fatal(e)
	}
}
