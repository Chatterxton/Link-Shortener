package config

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	DatabaseURL     string
	JWTSecret       string
	JWTTTLHours     int
	ListenAddr      string
	ShortCodeLength int
	PublicDomain    string
	PublicScheme    string
	PublicPort      string
}

func Load() *Config {
	return &Config{
		DatabaseURL:     mustEnv("DATABASE_URL"),
		JWTSecret:       mustEnv("JWT_SECRET"),
		JWTTTLHours:     atoiOr("JWT_TTL_HOURS", 72),
		ListenAddr:      envOr("LISTEN_ADDR", ":8080"),
		ShortCodeLength: atoiOr("SHORT_CODE_LENGTH", 7),
		PublicDomain:    envOr("PUBLIC_DOMAIN", "localhost"),
		PublicScheme:    envOr("PUBLIC_SCHEME", "http"),
		PublicPort:      os.Getenv("PUBLIC_PORT_SUFFIX"),
	}
}

func (c *Config) PublicBase() string {
	return c.PublicScheme + "://" + c.PublicDomain + c.PublicPort
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func mustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("env %s required", k)
	}
	return v
}

func atoiOr(k string, def int) int {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
