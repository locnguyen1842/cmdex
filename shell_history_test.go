package main

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func testHistoryEnv(t *testing.T, goos string, vars map[string]string) historyEnv {
	t.Helper()
	return historyEnv{
		home: t.TempDir(),
		goos: goos,
		getenv: func(key string) string {
			return vars[key]
		},
	}
}

func writeHistoryFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func TestShellHistoryFormat(t *testing.T) {
	cases := map[string]historyFormat{
		"/bin/zsh":                             historyFormatZsh,
		"/opt/homebrew/bin/bash":               historyFormatBash,
		"/usr/local/bin/fish":                  historyFormatFish,
		`C:\Program Files\PowerShell\pwsh.exe`: historyFormatPwsh,
		`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`: historyFormatPwsh,
		`C:\Windows\System32\cmd.exe`:                               historyFormatNone,
		"cmd":                                                       historyFormatNone,
		"":                                                          historyFormatNone,
		"/bin/sh":                                                   historyFormatPlain,
		"/usr/bin/nu":                                               historyFormatPlain,
	}
	for shell, want := range cases {
		if got := shellHistoryFormat(shell); got != want {
			t.Errorf("shellHistoryFormat(%q) = %q, want %q", shell, got, want)
		}
	}
}

func TestParseZshHistory(t *testing.T) {
	// Extended-history timestamps, a backslash-continued multi-line command,
	// a plain (non-extended) line, and a metafied UTF-8 byte (0xC3 0xA9 "é"
	// is written as 0x83 0xE3 0x83 0x89 by zsh).
	raw := ": 1700000000:0;git status\n" +
		": 1700000001:0;for i in 1 2; do\\\n  echo $i\\\ndone\n" +
		"ls -la\n" +
		": 1700000002:0;echo caf\x83\xe3\x83\x89\n"
	got := parseZshHistory([]byte(raw))
	want := []string{
		"git status",
		"for i in 1 2; do\n  echo $i\ndone",
		"ls -la",
		"echo café",
		"", // trailing newline yields an empty final entry; dedupe drops it
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("parseZshHistory = %q, want %q", got, want)
	}
}

func TestParseBashHistory(t *testing.T) {
	raw := "#1700000000\ngit status\n#1700000001\nls -la\n# not a timestamp\necho done\n"
	got := parseBashHistory([]byte(raw))
	want := []string{"git status", "ls -la", "# not a timestamp", "echo done", ""}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("parseBashHistory = %q, want %q", got, want)
	}
}

func TestParseFishHistory(t *testing.T) {
	raw := "- cmd: git status\n  when: 1700000000\n" +
		"- cmd: echo a\\\\b\n  when: 1700000001\n  paths:\n    - /tmp\n" +
		"- cmd: for i in 1 2\\n  echo $i\\nend\n  when: 1700000002\n"
	got := parseFishHistory([]byte(raw))
	want := []string{"git status", `echo a\b`, "for i in 1 2\n  echo $i\nend"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("parseFishHistory = %q, want %q", got, want)
	}
}

func TestParsePwshHistory(t *testing.T) {
	raw := "Get-ChildItem\nGet-Process |`\n  Sort-Object CPU\ndotnet build\n"
	got := parseShellHistory(historyFormatPwsh, []byte(raw))
	want := []string{"Get-ChildItem", "Get-Process |\n  Sort-Object CPU", "dotnet build", ""}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("parsePwshHistory = %q, want %q", got, want)
	}
}

func TestDedupeRecentFirst(t *testing.T) {
	entries := []string{"git status", "  ls  ", "", "multi\nline", "git status", "make build", "ls"}
	got := dedupeRecentFirst(entries, 10)
	want := []string{"ls", "make build", "git status"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("dedupeRecentFirst = %q, want %q", got, want)
	}

	if got := dedupeRecentFirst(entries, 2); !reflect.DeepEqual(got, []string{"ls", "make build"}) {
		t.Errorf("dedupeRecentFirst limit 2 = %q", got)
	}
	if got := dedupeRecentFirst(nil, 5); len(got) != 0 {
		t.Errorf("dedupeRecentFirst(nil) = %q, want empty", got)
	}
}

func TestShellHistoryCandidates(t *testing.T) {
	env := testHistoryEnv(t, "darwin", map[string]string{"HISTFILE": "/custom/hist", "ZDOTDIR": "/zdot"})

	zsh := shellHistoryCandidates("/bin/zsh", env)
	wantZsh := []string{
		"/custom/hist",
		filepath.Join("/zdot", ".zsh_history"),
		filepath.Join(env.home, ".zsh_history"),
		filepath.Join(env.home, ".zhistory"),
		filepath.Join(env.home, ".histfile"),
	}
	if got := historyPaths(zsh); !reflect.DeepEqual(got, wantZsh) {
		t.Errorf("zsh candidates = %q, want %q", got, wantZsh)
	}
	for _, src := range zsh {
		if src.Format != historyFormatZsh {
			t.Errorf("zsh candidate %s has format %q", src.Path, src.Format)
		}
	}

	if got := shellHistoryCandidates("cmd", env); got != nil {
		t.Errorf("cmd candidates = %v, want nil", got)
	}

	fish := historyPaths(shellHistoryCandidates("/usr/local/bin/fish", testHistoryEnv(t, "linux", nil)))
	if len(fish) != 1 || !strings.HasSuffix(fish[0], filepath.Join(".local", "share", "fish", "fish_history")) {
		t.Errorf("fish candidates = %q", fish)
	}

	winEnv := testHistoryEnv(t, "windows", map[string]string{"APPDATA": `C:\Users\me\AppData\Roaming`})
	pwsh := historyPaths(shellHistoryCandidates(`C:\Program Files\PowerShell\pwsh.exe`, winEnv))
	if len(pwsh) != 1 || !strings.Contains(pwsh[0], "PSReadLine") {
		t.Errorf("pwsh candidates on windows = %q", pwsh)
	}

	plain := historyPaths(shellHistoryCandidates("/bin/sh", env))
	if !reflect.DeepEqual(plain, []string{"/custom/hist"}) {
		t.Errorf("plain candidates = %q, want only HISTFILE", plain)
	}
	if got := shellHistoryCandidates("/bin/sh", testHistoryEnv(t, "linux", nil)); len(got) != 0 {
		t.Errorf("plain candidates without HISTFILE = %v, want none", got)
	}
}

func historyPaths(sources []historySource) []string {
	out := make([]string, 0, len(sources))
	for _, s := range sources {
		out = append(out, s.Path)
	}
	return out
}

func TestLoadShellHistory(t *testing.T) {
	env := testHistoryEnv(t, "darwin", nil)
	histPath := filepath.Join(env.home, ".zsh_history")
	writeHistoryFile(t, histPath, ": 1:0;git status\n: 2:0;ls\n: 3:0;git status\n: 4:0;make build\n")

	var cache shellHistoryCache
	got, err := loadShellHistory("/bin/zsh", 0, env, &cache)
	if err != nil {
		t.Fatalf("loadShellHistory: %v", err)
	}
	want := []string{"make build", "git status", "ls"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("loadShellHistory = %q, want %q", got, want)
	}

	if got, err := loadShellHistory("/bin/zsh", 2, env, &cache); err != nil || !reflect.DeepEqual(got, want[:2]) {
		t.Errorf("loadShellHistory limit 2 = %q, %v", got, err)
	}

	// Unchanged file: served from cache (same slice contents, no reparse).
	if got, err := loadShellHistory("/bin/zsh", 0, env, &cache); err != nil || !reflect.DeepEqual(got, want) {
		t.Errorf("cached loadShellHistory = %q, %v", got, err)
	}

	// Changed file: the cache must notice via size/mtime and reparse.
	writeHistoryFile(
		t,
		histPath,
		": 1:0;git status\n: 2:0;ls\n: 3:0;git status\n: 4:0;make build\n: 5:0;go test ./...\n",
	)
	future := time.Now().Add(2 * time.Second)
	if err := os.Chtimes(histPath, future, future); err != nil {
		t.Fatalf("chtimes: %v", err)
	}
	got, err = loadShellHistory("/bin/zsh", 0, env, &cache)
	if err != nil {
		t.Fatalf("loadShellHistory after change: %v", err)
	}
	if len(got) == 0 || got[0] != "go test ./..." {
		t.Errorf("loadShellHistory after change = %q, want newest first", got)
	}
}

func TestLoadShellHistoryMissingFile(t *testing.T) {
	env := testHistoryEnv(t, "linux", nil)
	var cache shellHistoryCache
	got, err := loadShellHistory("/bin/bash", 0, env, &cache)
	if err != nil {
		t.Fatalf("loadShellHistory: %v", err)
	}
	if got == nil || len(got) != 0 {
		t.Errorf("loadShellHistory with no history file = %#v, want empty non-nil slice", got)
	}
}

func TestReadFileTailDropsPartialFirstLine(t *testing.T) {
	path := filepath.Join(t.TempDir(), "hist")
	writeHistoryFile(t, path, "first line\nsecond line\nthird line\n")

	full, err := readFileTail(path, 1<<20)
	if err != nil {
		t.Fatalf("readFileTail full: %v", err)
	}
	if string(full) != "first line\nsecond line\nthird line\n" {
		t.Errorf("readFileTail full = %q", full)
	}

	tail, err := readFileTail(path, int64(len("nd line\nthird line\n")))
	if err != nil {
		t.Fatalf("readFileTail tail: %v", err)
	}
	if string(tail) != "third line\n" {
		t.Errorf("readFileTail tail = %q, want only complete lines", tail)
	}
}

func TestSuggestionServiceGetShellHistoryWithoutTerminal(t *testing.T) {
	prev := terminalSvc
	terminalSvc = nil
	defer func() { terminalSvc = prev }()

	// Whatever the host shell is, the method must return a slice (never nil)
	// and never panic when no terminal service is registered.
	svc := &SuggestionService{}
	if got := svc.GetShellHistory("", 5); got == nil {
		t.Error("GetShellHistory returned nil, want a non-nil slice")
	} else if len(got) > 5 {
		t.Errorf("GetShellHistory returned %d entries, want at most 5", len(got))
	}
}
