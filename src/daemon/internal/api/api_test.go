package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nilext/mitom-diagram/daemon/internal/store"
)

func newTestServer(t *testing.T, webDir string) http.Handler {
	t.Helper()
	s, err := store.NewFileStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return New(s, Config{Version: "test", WebDir: webDir, AllowedHosts: []string{"localhost", "127.0.0.1", "example.com"}}).Handler()
}

func do(t *testing.T, h http.Handler, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, target, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestDiagramLifecycle(t *testing.T) {
	h := newTestServer(t, "")

	rec := do(t, h, "POST", "/api/diagrams", `{"name":"  Shop  ","kind":"database","content":{"tables":[]}}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	var created store.Diagram
	json.Unmarshal(rec.Body.Bytes(), &created)
	if created.Name != "Shop" {
		t.Fatalf("expected trimmed name, got %q", created.Name)
	}

	rec = do(t, h, "PUT", "/api/diagrams/"+created.ID, `{"name":"Shop 2","kind":"database","content":{"tables":[1]}}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("update: %d %s", rec.Code, rec.Body)
	}

	rec = do(t, h, "GET", "/api/diagrams/"+created.ID, "")
	var got store.Diagram
	json.Unmarshal(rec.Body.Bytes(), &got)
	if got.Name != "Shop 2" || string(got.Content) != `{"tables":[1]}` {
		t.Fatalf("unexpected get: %s", rec.Body)
	}

	rec = do(t, h, "GET", "/api/diagrams", "")
	var list []store.Summary
	json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list) != 1 {
		t.Fatalf("expected 1 diagram, got %s", rec.Body)
	}

	if rec = do(t, h, "DELETE", "/api/diagrams/"+created.ID, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("delete: %d", rec.Code)
	}
	if rec = do(t, h, "GET", "/api/diagrams/"+created.ID, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("get after delete: %d", rec.Code)
	}
}

func TestValidation(t *testing.T) {
	h := newTestServer(t, "")
	cases := []struct {
		name, body string
		want       int
	}{
		{"bad json", `{`, http.StatusBadRequest},
		{"bad kind", `{"kind":"mindmap"}`, http.StatusBadRequest},
		{"long name", `{"name":"` + strings.Repeat("x", 201) + `"}`, http.StatusBadRequest},
		{"defaults", `{}`, http.StatusCreated},
	}
	for _, c := range cases {
		if rec := do(t, h, "POST", "/api/diagrams", c.body); rec.Code != c.want {
			t.Errorf("%s: got %d want %d (%s)", c.name, rec.Code, c.want, rec.Body)
		}
	}
}

func TestRejectsNonJSONWrites(t *testing.T) {
	h := newTestServer(t, "")
	req := httptest.NewRequest("POST", "/api/diagrams", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d", rec.Code)
	}
}

func TestRejectsUnknownHost(t *testing.T) {
	h := newTestServer(t, "")
	req := httptest.NewRequest("GET", "/api/health", nil)
	req.Host = "evil.test:7420"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestServesSPA(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o600)
	os.WriteFile(filepath.Join(dir, "app.js"), []byte("console.log(1)"), 0o600)
	h := newTestServer(t, dir)

	if rec := do(t, h, "GET", "/app.js", ""); !strings.Contains(rec.Body.String(), "console.log") {
		t.Fatalf("expected asset, got %d %s", rec.Code, rec.Body)
	}
	if rec := do(t, h, "GET", "/some/client/route", ""); !strings.Contains(rec.Body.String(), "app") {
		t.Fatalf("expected index fallback, got %d %s", rec.Code, rec.Body)
	}
	if rec := do(t, h, "GET", "/api/unknown", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("expected api 404, got %d", rec.Code)
	}
}
