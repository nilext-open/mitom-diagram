// Package store persists diagrams as one JSON file per diagram on local disk.
package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	ErrNotFound  = errors.New("diagram not found")
	ErrInvalidID = errors.New("invalid diagram id")
)

var idPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// Diagram is a stored diagram. Content is opaque to the daemon so new diagram
// kinds (e.g. architecture) can be added on the client without daemon changes.
type Diagram struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Kind      string          `json:"kind"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
	Content   json.RawMessage `json:"content"`
}

// Summary is the metadata returned when listing diagrams.
type Summary struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Kind      string    `json:"kind"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type FileStore struct {
	dir string
	mu  sync.RWMutex
	now func() time.Time
}

func NewFileStore(dir string) (*FileStore, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	return &FileStore{dir: dir, now: func() time.Time { return time.Now().UTC() }}, nil
}

func (s *FileStore) Dir() string { return s.dir }

func (s *FileStore) path(id string) (string, error) {
	if !idPattern.MatchString(id) {
		return "", ErrInvalidID
	}
	return filepath.Join(s.dir, id+".json"), nil
}

func (s *FileStore) List() ([]Summary, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	out := make([]Summary, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.dir, e.Name()))
		if err != nil {
			return nil, err
		}
		var sum Summary
		if err := json.Unmarshal(data, &sum); err != nil || sum.ID == "" {
			log.Printf("store: skipping unreadable file %s: %v", e.Name(), err)
			continue
		}
		out = append(out, sum)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out, nil
}

func (s *FileStore) Get(id string) (Diagram, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.read(id)
}

func (s *FileStore) read(id string) (Diagram, error) {
	p, err := s.path(id)
	if err != nil {
		return Diagram{}, err
	}
	data, err := os.ReadFile(p)
	if errors.Is(err, os.ErrNotExist) {
		return Diagram{}, ErrNotFound
	}
	if err != nil {
		return Diagram{}, err
	}
	var d Diagram
	if err := json.Unmarshal(data, &d); err != nil {
		return Diagram{}, fmt.Errorf("decode diagram %s: %w", id, err)
	}
	return d, nil
}

func (s *FileStore) Create(d Diagram) (Diagram, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := newID()
	if err != nil {
		return Diagram{}, err
	}
	now := s.now()
	d.ID, d.CreatedAt, d.UpdatedAt = id, now, now
	if err := s.write(d); err != nil {
		return Diagram{}, err
	}
	return d, nil
}

// Update replaces name, kind and content of an existing diagram.
func (s *FileStore) Update(id string, d Diagram) (Diagram, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, err := s.read(id)
	if err != nil {
		return Diagram{}, err
	}
	existing.Name, existing.Kind, existing.Content = d.Name, d.Kind, d.Content
	existing.UpdatedAt = s.now()
	if err := s.write(existing); err != nil {
		return Diagram{}, err
	}
	return existing, nil
}

func (s *FileStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	p, err := s.path(id)
	if err != nil {
		return err
	}
	if err := os.Remove(p); errors.Is(err, os.ErrNotExist) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	return nil
}

func (s *FileStore) write(d Diagram) error {
	p, err := s.path(d.ID)
	if err != nil {
		return err
	}
	data, err := json.Marshal(d)
	if err != nil {
		return err
	}
	return writeAtomic(p, data)
}

// writeAtomic writes to a temp file in the same directory and renames it so a
// crash never leaves a half-written diagram behind.
func writeAtomic(path string, data []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

func newID() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
