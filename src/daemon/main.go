// Command mitom-daemon is the local backend for Mitom Diagram. It stores
// diagrams on disk and serves the web client.
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/nilext/mitom-diagram/daemon/internal/api"
	"github.com/nilext/mitom-diagram/daemon/internal/store"
)

var version = "dev"

func main() {
	addr := flag.String("addr", envOr("MITOM_ADDR", "127.0.0.1:7420"), "listen address")
	dataDir := flag.String("data", envOr("MITOM_DATA_DIR", defaultDataDir()), "directory where diagrams are stored")
	webDir := flag.String("web", os.Getenv("MITOM_WEB_DIR"), "directory of the built web client to serve (optional)")
	hosts := flag.String("allowed-hosts", envOr("MITOM_ALLOWED_HOSTS", "localhost,127.0.0.1,::1"), "comma-separated Host header allowlist, or * to disable")
	flag.Parse()

	st, err := store.NewFileStore(*dataDir)
	if err != nil {
		log.Fatal(err)
	}

	srv := &http.Server{
		Addr: *addr,
		Handler: api.New(st, api.Config{
			Version:      version,
			WebDir:       *webDir,
			AllowedHosts: splitList(*hosts),
		}).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("mitom-daemon %s listening on http://%s (data: %s)", version, *addr, st.Dir())
		if *webDir != "" {
			log.Printf("serving web client from %s", *webDir)
		}
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	log.Print("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func defaultDataDir() string {
	if dir, err := os.UserConfigDir(); err == nil {
		return filepath.Join(dir, "mitom-diagram", "diagrams")
	}
	return filepath.Join(".", "data")
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
