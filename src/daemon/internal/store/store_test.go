package store

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func newTestStore(t *testing.T) *FileStore {
	t.Helper()
	s, err := NewFileStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestCRUD(t *testing.T) {
	s := newTestStore(t)

	created, err := s.Create(Diagram{Name: "shop", Kind: "database", Content: json.RawMessage(`{"tables":[]}`)})
	if err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || created.CreatedAt.IsZero() {
		t.Fatalf("expected id and timestamps, got %+v", created)
	}

	got, err := s.Get(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "shop" || string(got.Content) != `{"tables":[]}` {
		t.Fatalf("unexpected diagram %+v", got)
	}

	updated, err := s.Update(created.ID, Diagram{Name: "shop v2", Kind: "database", Content: json.RawMessage(`{}`)})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "shop v2" || !updated.CreatedAt.Equal(created.CreatedAt) {
		t.Fatalf("unexpected update result %+v", updated)
	}

	list, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Name != "shop v2" {
		t.Fatalf("unexpected list %+v", list)
	}

	if err := s.Delete(created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Get(created.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
	if err := s.Delete(created.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound on second delete, got %v", err)
	}
}

func TestListSortedByUpdatedDesc(t *testing.T) {
	s := newTestStore(t)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	tick := 0
	s.now = func() time.Time { tick++; return base.Add(time.Duration(tick) * time.Minute) }

	a, _ := s.Create(Diagram{Name: "a", Kind: "database", Content: json.RawMessage(`{}`)})
	s.Create(Diagram{Name: "b", Kind: "database", Content: json.RawMessage(`{}`)})
	s.Update(a.ID, Diagram{Name: "a", Kind: "database", Content: json.RawMessage(`{}`)})

	list, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].Name != "a" || list[1].Name != "b" {
		t.Fatalf("unexpected order %+v", list)
	}
}

func TestRejectsPathTraversalIDs(t *testing.T) {
	s := newTestStore(t)
	for _, id := range []string{"../etc/passwd", "a/b", "", "..", "a.json"} {
		if _, err := s.Get(id); !errors.Is(err, ErrInvalidID) {
			t.Errorf("Get(%q): expected ErrInvalidID, got %v", id, err)
		}
		if err := s.Delete(id); !errors.Is(err, ErrInvalidID) {
			t.Errorf("Delete(%q): expected ErrInvalidID, got %v", id, err)
		}
	}
}
