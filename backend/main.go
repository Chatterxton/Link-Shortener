package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/vladimir/link-shortener/internal/auth"
	"github.com/vladimir/link-shortener/internal/config"
	"github.com/vladimir/link-shortener/internal/db"
	"github.com/vladimir/link-shortener/internal/handlers"
	appmw "github.com/vladimir/link-shortener/internal/middleware"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("db migrate: %v", err)
	}

	jwtMgr := auth.NewJWTManager(cfg.JWTSecret, time.Duration(cfg.JWTTTLHours)*time.Hour)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(appmw.CORS)

	authH := handlers.NewAuthHandler(pool, jwtMgr)
	linksH := handlers.NewLinksHandler(pool, cfg)
	adminH := handlers.NewAdminHandler(pool, cfg)
	redirectH := handlers.NewRedirectHandler(pool)

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/register", authH.Register)
		r.Post("/auth/login", authH.Login)

		r.Group(func(r chi.Router) {
			r.Use(appmw.RequireAuth(jwtMgr))

			r.Get("/auth/me", authH.Me)

			r.Get("/links", linksH.List)
			r.Post("/links", linksH.Create)
			r.Delete("/links/{id}", linksH.Delete)

			r.Group(func(r chi.Router) {
				r.Use(appmw.RequireAdmin)
				r.Get("/admin/users", adminH.ListUsers)
				r.Delete("/admin/users/{id}", adminH.DeleteUser)
				r.Get("/admin/links", adminH.ListAllLinks)
			})
		})
	})

	r.Get("/r/{code}", redirectH.Redirect)
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", cfg.ListenAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
