package main

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// SuggestionService feeds the terminal's Warp-style autosuggestions: as the
// user types at the shell prompt, Terminal.tsx shows the most recent matching
// command as inline ghost text and lists further matches (shell history plus
// saved Cmdex commands) in a menu under the cursor. The saved-command half
// already lives in the frontend's state; this service supplies the other
// half by reading the session shell's own history file (shell_history.go).
type SuggestionService struct {
	cache shellHistoryCache
}

// ServiceStartup implements the Wails v3 service lifecycle hook for startup.
// Nothing to prepare: history is read lazily on the first request.
func (s *SuggestionService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return nil
}

// GetShellHistory returns the most recent distinct single-line commands from
// the history file of the shell running in sessionID ("" = the active
// session), newest first. limit <= 0 uses shellHistoryDefaultLimit; larger
// values are capped at shellHistoryMaxLimit. Like the other read-style bound
// methods it never surfaces an error to the frontend: on any failure it logs
// and returns an empty slice, and a shell with no readable history (cmd.exe,
// or a history file that doesn't exist yet) is simply empty.
func (s *SuggestionService) GetShellHistory(sessionID string, limit int) []string {
	entries, err := loadShellHistory(sessionShellPath(sessionID), limit, currentHistoryEnv(), &s.cache)
	if err != nil {
		fmt.Println("GetShellHistory error:", err)
		return []string{}
	}
	return entries
}

// PathCompletion is one filesystem entry offered while completing a path
// argument at the prompt.
type PathCompletion struct {
	// Name is the entry's display name (a directory name ends with "/").
	Name string `json:"name"`
	// Insert is the full replacement for the token being completed: the
	// typed directory part plus the entry, shell-escaped, with a trailing "/"
	// for directories so the user can keep drilling down.
	Insert string `json:"insert"`
	IsDir  bool   `json:"isDir"`
}

// CompletePath lists the entries of the directory named by partial (relative
// to the session's current working directory, "~" and absolute paths
// honored) whose names start with partial's last path segment. dirsOnly
// restricts the list to directories (cd). Hidden entries are included only
// when the segment itself starts with ".". Read-style: never errors, at most
// maxPathCompletions entries, directories first.
func (s *SuggestionService) CompletePath(sessionID string, partial string, dirsOnly bool) []PathCompletion {
	return completePath(sessionCwd(sessionID), partial, dirsOnly, shellDialectFor(sessionShellPath(sessionID)))
}

// CompleteCommands lists executables on the session shell's PATH plus that
// shell's builtins whose names start with prefix (case-insensitive), sorted,
// at most maxCommandCompletions. Read-style: never errors.
func (s *SuggestionService) CompleteCommands(sessionID string, prefix string) []string {
	return completeCommands(sessionShellPath(sessionID), prefix)
}

// sessionShellPath returns the shell binary the given session runs (the
// active session when sessionID is empty), falling back to detectShell for a
// session that hasn't started yet or when the terminal service is absent.
func sessionShellPath(sessionID string) string {
	if terminalSvc != nil {
		if ss, err := terminalSvc.resolveSession(sessionID); err == nil {
			ss.mu.Lock()
			shellPath := ss.shellPath
			ss.mu.Unlock()
			if shellPath != "" {
				return shellPath
			}
		}
	}
	shellPath, _ := detectShell()
	return shellPath
}
