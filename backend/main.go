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
	"github.com/go-chi/httprate"

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

	jwtTTL := time.Duration(cfg.JWTTTLHours) * time.Hour
	jwtMgr := auth.NewJWTManager(cfg.JWTSecret, jwtTTL)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(appmw.SecurityHeaders)
	r.Use(appmw.CORS(cfg.CORSOrigin))

	authH := handlers.NewAuthHandler(pool, jwtMgr, cfg.CookieSecure(), jwtTTL)
	linksH := handlers.NewLinksHandler(pool, cfg)
	adminH := handlers.NewAdminHandler(pool, cfg)
	redirectH := handlers.NewRedirectHandler(pool)

	loginLimiter := httprate.LimitByIP(cfg.LoginRatePerMin, time.Minute)
	redirectLimiter := httprate.LimitByIP(cfg.RedirectRatePerMin, time.Minute)

	r.Route("/api", func(r chi.Router) {
		r.Get("/auth/needs-bootstrap", authH.NeedsBootstrap)

		r.Group(func(r chi.Router) {
			r.Use(loginLimiter)
			r.Post("/auth/register", authH.Register)
			r.Post("/auth/login", authH.Login)
		})

		r.Post("/auth/logout", authH.Logout)

		r.Group(func(r chi.Router) {
			r.Use(appmw.RequireAuth(jwtMgr))

			r.Get("/auth/me", authH.Me)

			r.Get("/links", linksH.List)
			r.Post("/links", linksH.Create)
			r.Delete("/links/{id}", linksH.Delete)

			r.Group(func(r chi.Router) {
				r.Use(appmw.RequireAdmin)
				r.Get("/admin/users", adminH.ListUsers)
				r.Post("/admin/users", adminH.CreateUser)
				r.Delete("/admin/users/{id}", adminH.DeleteUser)
				r.Get("/admin/links", adminH.ListAllLinks)
			})
		})
	})

	r.Group(func(r chi.Router) {
		r.Use(redirectLimiter)
		r.Get("/r/{code}", redirectH.Redirect)
	})

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
