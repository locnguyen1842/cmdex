package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

const maxExecutionRecords = 100

// Store handles persistence of application data to JSON files
type Store struct {
	mu             sync.Mutex
	dataDir        string
	filePath       string
	executionsPath string
	data           AppData
	executions     []ExecutionRecord
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
		dataDir:        dataDir,
		filePath:       filepath.Join(dataDir, "data.json"),
		executionsPath: filepath.Join(dataDir, "executions.json"),
		data: AppData{
			Categories: []Category{},
			Commands:   []Command{},
			Settings:   AppSettings{Locale: "en"},
		},
		executions: []ExecutionRecord{},
	}

	fmt.Println("Store created at", s.filePath)

	if err := s.Load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
		if err := s.Save(); err != nil {
			return nil, err
		}
	}

	if err := s.loadExecutions(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	s.migrateExecutions()

	return s, nil
}

// migrateExecutions moves executions from data.json to executions.json (one-time migration)
func (s *Store) migrateExecutions() {
	raw, err := os.ReadFile(s.filePath)
	if err != nil {
		return
	}

	var legacy struct {
		Executions []ExecutionRecord `json:"executions"`
	}
	if err := json.Unmarshal(raw, &legacy); err != nil || len(legacy.Executions) == 0 {
		return
	}

	s.mu.Lock()
	s.executions = append(s.executions, legacy.Executions...)
	s.sortAndCapExecutions()
	s.mu.Unlock()

	_ = s.saveExecutions()

	// Re-save data.json without the executions field
	_ = s.Save()
}

// Load reads app data from the JSON file
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

	if data.Categories == nil {
		data.Categories = []Category{}
	}
	if data.Commands == nil {
		data.Commands = []Command{}
	}
	if data.Settings.Locale == "" {
		data.Settings.Locale = "en"
	}
	for i := range data.Commands {
		if data.Commands[i].Variables == nil {
			data.Commands[i].Variables = []VariableDefinition{}
		}
		if data.Commands[i].Presets == nil {
			data.Commands[i].Presets = []VariablePreset{}
		}
	}

	s.data = data
	return nil
}

// Save writes app data to the JSON file
func (s *Store) Save() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, raw, 0644)
}

// GetData returns a copy of the current data
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

// ========== Execution Records (separate file) ==========

func (s *Store) loadExecutions() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	raw, err := os.ReadFile(s.executionsPath)
	if err != nil {
		return err
	}

	var records []ExecutionRecord
	if err := json.Unmarshal(raw, &records); err != nil {
		return err
	}
	if records == nil {
		records = []ExecutionRecord{}
	}
	s.executions = records
	return nil
}

func (s *Store) saveExecutions() error {
	raw, err := json.MarshalIndent(s.executions, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.executionsPath, raw, 0644)
}

// sortAndCapExecutions sorts desc by ExecutedAt and trims to maxExecutionRecords. Must hold mu.
func (s *Store) sortAndCapExecutions() {
	sort.Slice(s.executions, func(i, j int) bool {
		return s.executions[i].ExecutedAt.After(s.executions[j].ExecutedAt)
	})
	if len(s.executions) > maxExecutionRecords {
		s.executions = s.executions[:maxExecutionRecords]
	}
}

// GetExecutions returns execution records sorted newest-first
func (s *Store) GetExecutions() []ExecutionRecord {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]ExecutionRecord, len(s.executions))
	copy(out, s.executions)
	return out
}

// AddExecution appends a record, trims to max, and saves
func (s *Store) AddExecution(record ExecutionRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.executions = append([]ExecutionRecord{record}, s.executions...)
	s.sortAndCapExecutions()
	return s.saveExecutions()
}

// ClearExecutions removes all execution records
func (s *Store) ClearExecutions() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.executions = []ExecutionRecord{}
	return s.saveExecutions()
}
