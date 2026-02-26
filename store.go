package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Store handles persistence of application data to a JSON file
type Store struct {
	mu       sync.Mutex
	filePath string
	data     AppData
}

// NewStore creates a new Store instance
func NewStore() (*Store, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	dataDir := filepath.Join(homeDir, ".commamer")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	s := &Store{
		filePath: filepath.Join(dataDir, "data.json"),
		data: AppData{
			Categories: []Category{},
			Commands:   []Command{},
		},
	}

	if err := s.Load(); err != nil {
		// If file doesn't exist, that's fine — we start with empty data
		if !os.IsNotExist(err) {
			return nil, err
		}
		// Save initial empty data
		if err := s.Save(); err != nil {
			return nil, err
		}
	}

	return s, nil
}

// Load reads data from the JSON file
func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	raw, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var data AppData
	if err := json.Unmarshal(raw, &data); err != nil {
		return err
	}

	// Ensure slices are never nil
	if data.Categories == nil {
		data.Categories = []Category{}
	}
	if data.Commands == nil {
		data.Commands = []Command{}
	}

	s.data = data
	return nil
}

// Save writes data to the JSON file
func (s *Store) Save() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, raw, 0644)
}

// GetData returns a copy of the current data (must be called with lock held externally or be careful)
func (s *Store) GetData() AppData {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data
}

// SetData replaces the current data and saves
func (s *Store) SetData(data AppData) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = data
	return s.Save()
}
