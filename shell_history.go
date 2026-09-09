package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Shell history is the main source for the terminal's Warp-style
// autosuggestions (SuggestionService.GetShellHistory, rendered by
// frontend/src/components/Terminal.tsx). Each shell keeps its history in its
// own file and its own encoding, so this file knows where to look for a given
// shell binary and how to decode what it finds. Everything here is read-only:
// Cmdex never writes to a history file.

const (
	// shellHistoryDefaultLimit is how many entries GetShellHistory returns
	// when the caller passes limit <= 0.
	shellHistoryDefaultLimit = 2000

	// shellHistoryMaxLimit caps both the caller's limit and how many entries
	// the parsed cache retains, so a huge history can't be shipped to the
	// frontend wholesale.
	shellHistoryMaxLimit = 10000

	// shellHistoryTailBytes bounds how much of a history file is read: only
	// the tail, since the newest entries are the useful ones for suggestions
	// and zsh/bash histories routinely grow to many megabytes.
	shellHistoryTailBytes = 2 << 20

	// zshMetaByte introduces a "metafied" byte in a zsh history file: zsh
	// writes any byte >= 0x80 (and a few control bytes) as zshMetaByte
	// followed by the byte XOR zshMetaMask.
	zshMetaByte = 0x83
	zshMetaMask = 0x20
)

// historyFormat identifies how a history file's contents are encoded.
type historyFormat string

const (
	// historyFormatNone means the shell keeps no readable history (cmd.exe).
	historyFormatNone historyFormat = ""
	// historyFormatZsh is zsh's plain or extended (": <ts>:<dur>;cmd") format,
	// with backslash-newline continuations and metafied high bytes.
	historyFormatZsh historyFormat = "zsh"
	// historyFormatBash is one command per line, optionally interleaved with
	// "#<unix ts>" comment lines when HISTTIMEFORMAT is set.
	historyFormatBash historyFormat = "bash"
	// historyFormatFish is fish's YAML-like "- cmd: ..." records.
	historyFormatFish historyFormat = "fish"
	// historyFormatPwsh is PSReadLine's one-command-per-line file, with a
	// trailing backtick marking a continued line.
	historyFormatPwsh historyFormat = "pwsh"
	// historyFormatPlain is one command per line with no decoration, used for
	// unrecognized shells that still export HISTFILE.
	historyFormatPlain historyFormat = "plain"
)

// historySource is a candidate history file and how to decode it.
type historySource struct {
	Path   string
	Format historyFormat
}

// historyEnv is the slice of the process environment that history-file
// resolution depends on, abstracted so tests can point it at a temp dir.
type historyEnv struct {
	home   string
	goos   string
	getenv func(string) string
}

// shellHistoryCache memoizes the parsed contents of the most recently used
// history file, keyed on its size and mtime. Reparsing a multi-megabyte file
// on every keystroke-driven refresh would be wasteful; a stat per call is not.
type shellHistoryCache struct {
	mu      sync.Mutex
	path    string
	size    int64
	modTime time.Time
	entries []string
}

// zshExtendedPrefix matches the timestamp prefix zsh writes with the
// EXTENDED_HISTORY option: ": <start>:<elapsed>;".
var zshExtendedPrefix = regexp.MustCompile(`^: \d+:\d+;`)

// fishUnescaper reverses fish's history encoding of a command line: a
// backslash escapes itself, and "\n" stands for an embedded newline. Listing
// the doubled backslash first keeps "\\n" (an escaped backslash followed by
// a literal n) from being mistaken for a newline.
var fishUnescaper = strings.NewReplacer(`\\`, `\`, `\n`, "\n")

// load returns the entries for src, most recent first, deduplicated and
// capped at shellHistoryMaxLimit, reparsing only when the file changed since
// the last call.
func (c *shellHistoryCache) load(src historySource) ([]string, error) {
	info, err := os.Stat(src.Path)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.path == src.Path && c.size == info.Size() && c.modTime.Equal(info.ModTime()) {
		return c.entries, nil
	}

	data, err := readFileTail(src.Path, shellHistoryTailBytes)
	if err != nil {
		return nil, err
	}
	entries := dedupeRecentFirst(parseShellHistory(src.Format, data), shellHistoryMaxLimit)

	c.path = src.Path
	c.size = info.Size()
	c.modTime = info.ModTime()
	c.entries = entries
	return entries, nil
}

// currentHistoryEnv captures the real process environment.
func currentHistoryEnv() historyEnv {
	home, _ := os.UserHomeDir()
	return historyEnv{home: home, goos: runtime.GOOS, getenv: os.Getenv}
}

// loadShellHistory resolves the history file for shellPath, parses it (via
// cache), and returns up to limit entries, newest first. A shell with no
// readable history yields an empty, non-nil slice so the frontend always
// receives a JSON array.
func loadShellHistory(shellPath string, limit int, env historyEnv, cache *shellHistoryCache) ([]string, error) {
	if limit <= 0 {
		limit = shellHistoryDefaultLimit
	}
	limit = min(limit, shellHistoryMaxLimit)

	for _, src := range shellHistoryCandidates(shellPath, env) {
		if _, err := os.Stat(src.Path); err != nil {
			continue
		}
		entries, err := cache.load(src)
		if err != nil {
			return nil, fmt.Errorf("read %s history %s: %w", src.Format, src.Path, err)
		}
		n := min(limit, len(entries))
		out := make([]string, n)
		copy(out, entries[:n])
		return out, nil
	}
	return []string{}, nil
}

// shellHistoryFormat maps a shell binary to its history file format.
func shellHistoryFormat(shellPath string) historyFormat {
	switch shellBaseName(shellPath) {
	case "zsh":
		return historyFormatZsh
	case "bash":
		return historyFormatBash
	case "fish":
		return historyFormatFish
	case "pwsh", "powershell":
		return historyFormatPwsh
	case "cmd", "":
		return historyFormatNone
	default:
		return historyFormatPlain
	}
}

// shellHistoryCandidates lists where shellPath's history may live, most
// specific first. $HISTFILE is honored when the shell would honor it, but
// note a GUI app launched from the Dock/launchd rarely inherits it, so the
// per-shell defaults do the real work.
func shellHistoryCandidates(shellPath string, env historyEnv) []historySource {
	format := shellHistoryFormat(shellPath)
	var out []historySource
	add := func(path string, f historyFormat) {
		if path != "" {
			out = append(out, historySource{Path: path, Format: f})
		}
	}
	histfile := env.getenv("HISTFILE")

	switch format {
	case historyFormatNone:
		return nil
	case historyFormatZsh:
		add(histfile, historyFormatZsh)
		if zdotdir := env.getenv("ZDOTDIR"); zdotdir != "" {
			add(filepath.Join(zdotdir, ".zsh_history"), historyFormatZsh)
		}
		add(filepath.Join(env.home, ".zsh_history"), historyFormatZsh)
		add(filepath.Join(env.home, ".zhistory"), historyFormatZsh)
		add(filepath.Join(env.home, ".histfile"), historyFormatZsh)
	case historyFormatBash:
		add(histfile, historyFormatBash)
		add(filepath.Join(env.home, ".bash_history"), historyFormatBash)
	case historyFormatFish:
		if xdg := env.getenv("XDG_DATA_HOME"); xdg != "" {
			add(filepath.Join(xdg, "fish", "fish_history"), historyFormatFish)
		}
		add(filepath.Join(env.home, ".local", "share", "fish", "fish_history"), historyFormatFish)
	case historyFormatPwsh:
		const psReadLineFile = "ConsoleHost_history.txt"
		if env.goos == "windows" {
			if appdata := env.getenv("APPDATA"); appdata != "" {
				add(
					filepath.Join(appdata, "Microsoft", "Windows", "PowerShell", "PSReadLine", psReadLineFile),
					historyFormatPwsh,
				)
			}
		} else {
			if xdg := env.getenv("XDG_DATA_HOME"); xdg != "" {
				add(filepath.Join(xdg, "powershell", "PSReadLine", psReadLineFile), historyFormatPwsh)
			}
			add(
				filepath.Join(env.home, ".local", "share", "powershell", "PSReadLine", psReadLineFile),
				historyFormatPwsh,
			)
		}
	case historyFormatPlain:
		add(histfile, historyFormatPlain)
	}
	return out
}

// parseShellHistory decodes data into entries in file order (oldest first).
// Multi-line commands are kept intact here with embedded newlines;
// dedupeRecentFirst drops them, since the prompt can only take one line.
func parseShellHistory(format historyFormat, data []byte) []string {
	switch format {
	case historyFormatZsh:
		return parseZshHistory(data)
	case historyFormatBash:
		return parseBashHistory(data)
	case historyFormatFish:
		return parseFishHistory(data)
	case historyFormatPwsh:
		return parseContinuedLines(string(data), "`")
	case historyFormatPlain:
		return strings.Split(string(data), "\n")
	case historyFormatNone:
		return nil
	}
	return nil
}

// parseZshHistory handles both plain and EXTENDED_HISTORY zsh files. A line
// ending in a backslash continues on the next one — that's how zsh stores a
// multi-line command — and only the first physical line of an entry carries
// the extended-history timestamp prefix.
func parseZshHistory(data []byte) []string {
	var entries []string
	var pending strings.Builder
	continuing := false
	for line := range strings.SplitSeq(string(unmetafyZsh(data)), "\n") {
		if !continuing {
			if loc := zshExtendedPrefix.FindStringIndex(line); loc != nil {
				line = line[loc[1]:]
			}
		}
		if head, ok := strings.CutSuffix(line, `\`); ok {
			pending.WriteString(head)
			pending.WriteByte('\n')
			continuing = true
			continue
		}
		if continuing {
			pending.WriteString(line)
			entries = append(entries, pending.String())
			pending.Reset()
			continuing = false
			continue
		}
		entries = append(entries, line)
	}
	return entries
}

// unmetafyZsh reverses zsh's "metafication" of bytes that can't appear
// literally in its history file (see zshMetaByte). Files with no metafied
// bytes are returned as-is.
func unmetafyZsh(data []byte) []byte {
	if bytes.IndexByte(data, zshMetaByte) < 0 {
		return data
	}
	out := make([]byte, 0, len(data))
	for i := 0; i < len(data); i++ {
		if data[i] == zshMetaByte && i+1 < len(data) {
			i++
			out = append(out, data[i]^zshMetaMask)
			continue
		}
		out = append(out, data[i])
	}
	return out
}

// parseBashHistory drops the "#<unix timestamp>" comment lines bash writes
// between commands when HISTTIMEFORMAT is set.
func parseBashHistory(data []byte) []string {
	var entries []string
	for line := range strings.SplitSeq(string(data), "\n") {
		if isBashTimestampLine(line) {
			continue
		}
		entries = append(entries, line)
	}
	return entries
}

// isBashTimestampLine reports whether line is "#" followed only by digits.
func isBashTimestampLine(line string) bool {
	if len(line) < 2 || line[0] != '#' {
		return false
	}
	for _, r := range line[1:] {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// parseFishHistory extracts the "- cmd: <command>" line from each fish
// history record, ignoring the "when:" and "paths:" fields that follow it.
func parseFishHistory(data []byte) []string {
	const cmdPrefix = "- cmd: "
	var entries []string
	for line := range strings.SplitSeq(string(data), "\n") {
		if cmd, ok := strings.CutPrefix(line, cmdPrefix); ok {
			entries = append(entries, fishUnescaper.Replace(cmd))
		}
	}
	return entries
}

// parseContinuedLines splits data into lines, joining a line that ends with
// marker onto the one that follows it (the marker itself is dropped and
// replaced by a newline).
func parseContinuedLines(data, marker string) []string {
	var entries []string
	var pending strings.Builder
	continuing := false
	for line := range strings.SplitSeq(data, "\n") {
		if head, ok := strings.CutSuffix(line, marker); ok {
			pending.WriteString(head)
			pending.WriteByte('\n')
			continuing = true
			continue
		}
		if continuing {
			pending.WriteString(line)
			entries = append(entries, pending.String())
			pending.Reset()
			continuing = false
			continue
		}
		entries = append(entries, line)
	}
	return entries
}

// dedupeRecentFirst walks entries newest-first, trims them, and keeps the
// first occurrence of each distinct single-line command, up to limit. Blank
// entries and multi-line commands are skipped: the former are noise and the
// latter can't be typed onto a single prompt line.
func dedupeRecentFirst(entries []string, limit int) []string {
	capHint := min(len(entries), limit)
	seen := make(map[string]struct{}, capHint)
	out := make([]string, 0, capHint)
	for i := len(entries) - 1; i >= 0 && len(out) < limit; i-- {
		entry := strings.TrimSpace(entries[i])
		if entry == "" || strings.ContainsAny(entry, "\r\n") {
			continue
		}
		if _, dup := seen[entry]; dup {
			continue
		}
		seen[entry] = struct{}{}
		out = append(out, entry)
	}
	return out
}

// readFileTail returns at most the last maxBytes of the file at path. When
// the file is longer than that, the (probably partial) first line of the
// slice is dropped so no truncated entry leaks into the result.
func readFileTail(path string, maxBytes int64) ([]byte, error) {
	f, err := os.Open(path) //nolint:gosec // G304: path comes from the fixed per-shell candidate list, not user input.
	if err != nil {
		return nil, err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, err
	}
	truncated := info.Size() > maxBytes
	if truncated {
		if _, err := f.Seek(info.Size()-maxBytes, io.SeekStart); err != nil {
			return nil, err
		}
	}
	data, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}
	if truncated {
		if idx := bytes.IndexByte(data, '\n'); idx >= 0 {
			data = data[idx+1:]
		}
	}
	return data, nil
}
