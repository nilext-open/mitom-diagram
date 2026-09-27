// Package api exposes the diagram store over HTTP and optionally serves the
// built web client.
package api

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/nilext/mitom-diagram/daemon/internal/store"
)

const (
	maxBodyBytes  = 20 << 20
	maxNameLength = 200
	defaultName   = "Untitled diagram"
)

var validKinds = map[string]bool{"database": true, "architecture": true}

type Store interface {
	List() ([]store.Summary, error)
	Get(id string) (store.Diagram, error)
	Create(d store.Diagram) (store.Diagram, error)
	Update(id string, d store.Diagram) (store.Diagram, error)
	Delete(id string) error
}

type Config struct {
	Version string
	// WebDir, when set, is served as a single-page app on non-API paths.
	WebDir string
	// AllowedHosts guards against DNS rebinding. "*" disables the check.
	AllowedHosts []string
}

type Server struct {
	store Store
	cfg   Config
}

func New(s Store, cfg Config) *Server {
	return &Server{store: s, cfg: cfg}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/diagrams", s.listDiagrams)
	mux.HandleFunc("POST /api/diagrams", s.createDiagram)
	mux.HandleFunc("GET /api/diagrams/{id}", s.getDiagram)
	mux.HandleFunc("PUT /api/diagrams/{id}", s.updateDiagram)
	mux.HandleFunc("DELETE /api/diagrams/{id}", s.deleteDiagram)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})
	if s.cfg.WebDir != "" {
		mux.Handle("/", spaHandler(s.cfg.WebDir))
	}
	return logRequests(s.checkHost(requireJSON(mux)))
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": s.cfg.Version})
}

func (s *Server) listDiagrams(w http.ResponseWriter, r *http.Request) {
	list, err := s.store.List()
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) getDiagram(w http.ResponseWriter, r *http.Request) {
	d, err := s.store.Get(r.PathValue("id"))
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

type diagramInput struct {
	Name    string          `json:"name"`
	Kind    string          `json:"kind"`
	Content json.RawMessage `json:"content"`
}

func decodeInput(w http.ResponseWriter, r *http.Request) (store.Diagram, bool) {
	var in diagramInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return store.Diagram{}, false
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = defaultName
	}
	if len([]rune(name)) > maxNameLength {
		writeError(w, http.StatusBadRequest, "name is too long")
		return store.Diagram{}, false
	}
	if in.Kind == "" {
		in.Kind = "database"
	}
	if !validKinds[in.Kind] {
		writeError(w, http.StatusBadRequest, "unsupported diagram kind: "+in.Kind)
		return store.Diagram{}, false
	}
	content := in.Content
	if len(content) == 0 || string(content) == "null" {
		content = json.RawMessage(`{}`)
	}
	return store.Diagram{Name: name, Kind: in.Kind, Content: content}, true
}

func (s *Server) createDiagram(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeInput(w, r)
	if !ok {
		return
	}
	d, err := s.store.Create(in)
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

func (s *Server) updateDiagram(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeInput(w, r)
	if !ok {
		return
	}
	d, err := s.store.Update(r.PathValue("id"), in)
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

func (s *Server) deleteDiagram(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Delete(r.PathValue("id")); err != nil {
		s.storeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) storeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, store.ErrInvalidID):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		s.internalError(w, err)
	}
}

func (s *Server) internalError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal server error")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// requireJSON forces a CORS preflight for cross-site writes: browsers cannot
// send application/json cross-origin without one, and we never answer it.
func requireJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodPut {
			mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
			if mt != "application/json" {
				writeError(w, http.StatusUnsupportedMediaType, "Content-Type must be application/json")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) checkHost(next http.Handler) http.Handler {
	allowAll := false
	allowed := map[string]bool{}
	for _, h := range s.cfg.AllowedHosts {
		if h == "*" {
			allowAll = true
		}
		allowed[strings.ToLower(h)] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowAll {
			host := r.Host
			if h, _, err := net.SplitHostPort(host); err == nil {
				host = h
			}
			host = strings.Trim(strings.ToLower(host), "[]")
			if !allowed[host] {
				writeError(w, http.StatusForbidden, "host not allowed")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		if strings.HasPrefix(r.URL.Path, "/api/") {
			log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Microsecond))
		}
	})
}

// spaHandler serves static files and falls back to index.html so client-side
// routes keep working on reload.
func spaHandler(root string) http.Handler {
	fsys := os.DirFS(root)
	files := http.FileServer(http.FS(fsys))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if info, err := fs.Stat(fsys, name); err != nil || info.IsDir() {
			http.ServeFileFS(w, r, fsys, "index.html")
			return
		}
		files.ServeHTTP(w, r)
	})
}
