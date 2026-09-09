package main

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"slices"
	"strings"
	"testing"
)

// completionTree builds the fixture directory every completePath test
// reads: two visible directories, one visible file, a hidden file and a
// hidden directory, plus a directory with a space in its name.
func completionTree(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	for _, dir := range []string{"alpha", "gamma", ".hiddendir", "my dir", filepath.Join("alpha", "sub")} {
		if err := os.MkdirAll(filepath.Join(root, dir), 0o750); err != nil {
			t.Fatalf("mkdir %s: %v", dir, err)
		}
	}
	for _, file := range []string{"beta.txt", ".hidden", filepath.Join("alpha", "notes.md"), filepath.Join("my dir", "inner.txt")} {
		if err := os.WriteFile(filepath.Join(root, file), []byte("x"), 0o600); err != nil {
			t.Fatalf("write %s: %v", file, err)
		}
	}
	return root
}

// names and inserts flatten a completion list for assertions.
func names(list []PathCompletion) []string {
	out := make([]string, 0, len(list))
	for _, c := range list {
		out = append(out, c.Name)
	}
	return out
}

func inserts(list []PathCompletion) []string {
	out := make([]string, 0, len(list))
	for _, c := range list {
		out = append(out, c.Insert)
	}
	return out
}

func TestCompletePath_DirsFirstThenFilesSorted(t *testing.T) {
	root := completionTree(t)
	got := completePath(root, "", false, dialectPOSIX)

	want := []string{"alpha/", "gamma/", "my dir/", "beta.txt"}
	if !reflect.DeepEqual(names(got), want) {
		t.Errorf(
			"names = %q, want %q (directories first, each group sorted, hidden entries excluded)",
			names(got),
			want,
		)
	}
	for _, c := range got {
		if c.IsDir != strings.HasSuffix(c.Name, "/") {
			t.Errorf("%+v: IsDir must match the trailing slash on Name", c)
		}
	}
}

func TestCompletePath_PrefixFilter(t *testing.T) {
	root := completionTree(t)
	if got := names(completePath(root, "al", false, dialectPOSIX)); !reflect.DeepEqual(got, []string{"alpha/"}) {
		t.Errorf("prefix \"al\": names = %q, want [alpha/]", got)
	}
	got := completePath(root, "zzz", false, dialectPOSIX)
	if got == nil || len(got) != 0 {
		t.Errorf("no match: got %v, want an empty, non-nil slice", got)
	}
}

func TestCompletePath_CaseFoldingFollowsTheOS(t *testing.T) {
	root := completionTree(t)
	got := names(completePath(root, "AL", false, dialectPOSIX))
	if runtime.GOOS == "darwin" || runtime.GOOS == "windows" {
		if !reflect.DeepEqual(got, []string{"alpha/"}) {
			t.Errorf("names = %q, want [alpha/] (case-insensitive on %s)", got, runtime.GOOS)
		}
	} else if len(got) != 0 {
		t.Errorf("names = %q, want none (case-sensitive on %s)", got, runtime.GOOS)
	}
}

func TestCompletePath_HiddenEntriesOnlyWithDotPrefix(t *testing.T) {
	root := completionTree(t)
	got := names(completePath(root, ".", false, dialectPOSIX))
	want := []string{".hiddendir/", ".hidden"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("prefix \".\": names = %q, want %q", got, want)
	}
	for _, n := range names(completePath(root, "", false, dialectPOSIX)) {
		if strings.HasPrefix(n, ".") {
			t.Errorf("empty prefix must not list hidden entry %q", n)
		}
	}
}

func TestCompletePath_DirsOnly(t *testing.T) {
	root := completionTree(t)
	got := names(completePath(root, "", true, dialectPOSIX))
	want := []string{"alpha/", "gamma/", "my dir/"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("dirsOnly: names = %q, want %q", got, want)
	}
}

func TestCompletePath_TypedDirectoryPartIsKeptVerbatim(t *testing.T) {
	root := completionTree(t)
	got := completePath(root, "alpha/", false, dialectPOSIX)
	want := []string{"alpha/sub/", "alpha/notes.md"}
	if !reflect.DeepEqual(inserts(got), want) {
		t.Errorf("inserts = %q, want %q", inserts(got), want)
	}

	got = completePath(root, "./alpha/no", false, dialectPOSIX)
	if !reflect.DeepEqual(inserts(got), []string{"./alpha/notes.md"}) {
		t.Errorf("inserts = %q, want [./alpha/notes.md] (the \"./\" spelling must survive)", inserts(got))
	}
}

func TestCompletePath_AbsolutePath(t *testing.T) {
	root := completionTree(t)
	partial := filepath.Join(root, "al")
	got := completePath(t.TempDir(), partial, false, dialectPOSIX)
	// The typed part is verbatim (never re-escaped), so the Insert is simply
	// the typed prefix completed to the entry.
	want := []string{filepath.Join(root, "alpha") + "/"}
	if !reflect.DeepEqual(inserts(got), want) {
		t.Errorf("inserts = %q, want %q", inserts(got), want)
	}
}

func TestCompletePath_TildeExpandsToHome(t *testing.T) {
	root := completionTree(t)
	t.Setenv("HOME", root)
	t.Setenv("USERPROFILE", root) // os.UserHomeDir on Windows

	got := completePath(t.TempDir(), "~/al", false, dialectPOSIX)
	if !reflect.DeepEqual(inserts(got), []string{"~/alpha/"}) {
		t.Errorf("\"~/al\": inserts = %q, want [~/alpha/]", inserts(got))
	}
	got = completePath(t.TempDir(), "~", true, dialectPOSIX)
	if !reflect.DeepEqual(names(got), []string{"alpha/", "gamma/", "my dir/"}) || inserts(got)[0] != "~/alpha/" {
		t.Errorf(
			"bare \"~\": names = %q inserts = %q, want the home directory's entries under ~/",
			names(got),
			inserts(got),
		)
	}
}

func TestCompletePath_EscapesSpaceForPOSIX(t *testing.T) {
	root := completionTree(t)
	got := completePath(root, "my", false, dialectPOSIX)
	if !reflect.DeepEqual(inserts(got), []string{`my\ dir/`}) {
		t.Errorf("inserts = %q, want [my\\ dir/]", inserts(got))
	}
	if got[0].Name != "my dir/" {
		t.Errorf("Name = %q, want the unescaped display name \"my dir/\"", got[0].Name)
	}
}

func TestCompletePath_QuotesForPowerShellAndCmd(t *testing.T) {
	root := completionTree(t)
	sep := "/"
	if runtime.GOOS == "windows" {
		sep = `\`
	}
	pwsh := inserts(completePath(root, "my", false, dialectPowerShell))
	if want := []string{"'my dir" + sep + "'"}; !reflect.DeepEqual(pwsh, want) {
		t.Errorf("PowerShell inserts = %q, want %q", pwsh, want)
	}
	cmd := inserts(completePath(root, "my", false, dialectCmd))
	if want := []string{`"my dir` + sep + `"`}; !reflect.DeepEqual(cmd, want) {
		t.Errorf("cmd inserts = %q, want %q", cmd, want)
	}
	// No special characters: no quotes.
	plain := inserts(completePath(root, "al", false, dialectPowerShell))
	if want := []string{"alpha" + sep}; !reflect.DeepEqual(plain, want) {
		t.Errorf("PowerShell inserts = %q, want %q", plain, want)
	}
}

func TestCompletePath_TypedEscapedDirectoryPartResolves(t *testing.T) {
	root := completionTree(t)
	got := completePath(root, `my\ dir/in`, false, dialectPOSIX)
	if !reflect.DeepEqual(inserts(got), []string{`my\ dir/inner.txt`}) {
		t.Errorf("inserts = %q, want [my\\ dir/inner.txt]", inserts(got))
	}
}

func TestCompletePath_OpenedQuoteIsKeptAndClosed(t *testing.T) {
	root := completionTree(t)
	double := inserts(completePath(root, `"my d`, false, dialectPOSIX))
	if want := []string{`"my dir/"`}; !reflect.DeepEqual(double, want) {
		t.Errorf("double-quoted inserts = %q, want %q", double, want)
	}
	single := inserts(completePath(root, `'my dir/`, false, dialectPOSIX))
	if want := []string{`'my dir/inner.txt'`}; !reflect.DeepEqual(single, want) {
		t.Errorf("single-quoted inserts = %q, want %q", single, want)
	}
}

func TestCompletePath_SymlinkToDirectoryIsADirectory(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink creation needs extra privileges on Windows")
	}
	root := completionTree(t)
	if err := os.Symlink(filepath.Join(root, "alpha"), filepath.Join(root, "link")); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	got := completePath(root, "li", false, dialectPOSIX)
	if len(got) != 1 || !got[0].IsDir || got[0].Name != "link/" || got[0].Insert != "link/" {
		t.Errorf("got %+v, want a single directory entry link/", got)
	}
}

func TestCompletePath_MissingDirectoryIsEmpty(t *testing.T) {
	root := completionTree(t)
	got := completePath(root, "does-not-exist/", false, dialectPOSIX)
	if got == nil || len(got) != 0 {
		t.Errorf("got %v, want an empty, non-nil slice", got)
	}
	got = completePath(filepath.Join(root, "nope"), "", false, dialectPOSIX)
	if got == nil || len(got) != 0 {
		t.Errorf("unreadable cwd: got %v, want an empty, non-nil slice", got)
	}
}

func TestCompletePath_CapsAtMaxPathCompletions(t *testing.T) {
	root := t.TempDir()
	for i := range maxPathCompletions + 10 {
		if err := os.Mkdir(filepath.Join(root, fmt.Sprintf("d%03d", i)), 0o750); err != nil {
			t.Fatalf("mkdir: %v", err)
		}
	}
	if got := completePath(root, "d", false, dialectPOSIX); len(got) != maxPathCompletions {
		t.Errorf("len = %d, want %d", len(got), maxPathCompletions)
	}
}

func TestEscapePOSIXWord(t *testing.T) {
	cases := map[string]string{
		"plain":       "plain",
		"a b":         `a\ b`,
		`it's`:        `it\'s`,
		`say "hi"`:    `say\ \"hi\"`,
		"$HOME&(x);|": `\$HOME\&\(x\)\;\|`,
		"<in>out`":    `\<in\>out\` + "`",
		`back\slash`:  `back\\slash`,
		"glob*?[x]":   `glob\*\?\[x\]`,
	}
	for in, want := range cases {
		if got := escapePOSIXWord(in, false); got != want {
			t.Errorf("escapePOSIXWord(%q) = %q, want %q", in, got, want)
		}
	}
	if got := escapePOSIXWord("~tmp", true); got != `\~tmp` {
		t.Errorf("leading ~ at word start = %q, want \\~tmp", got)
	}
	if got := escapePOSIXWord("~tmp", false); got != "~tmp" {
		t.Errorf("~ after a directory part = %q, want ~tmp", got)
	}
}

// --- completeCommands ---

// fakeBinDir builds a PATH directory of the given executables (plus a
// non-executable file and a subdirectory that must never be listed) and
// points shellPathResolver at it for the rest of the test.
func fakeBinDir(t *testing.T, executables ...string) string {
	t.Helper()
	dir := t.TempDir()
	for _, name := range executables {
		writeExecutable(t, dir, name)
	}
	if err := os.WriteFile(filepath.Join(dir, "gzip-notes.txt"), []byte("not a command"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.Mkdir(filepath.Join(dir, "gdir"), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	previous := shellPathResolver
	shellPathResolver = func(string) string { return dir }
	commandCache.reset()
	t.Cleanup(func() {
		shellPathResolver = previous
		commandCache.reset()
	})
	return dir
}

func writeExecutable(t *testing.T, dir, name string) {
	t.Helper()
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	if err := os.WriteFile(
		filepath.Join(dir, name),
		[]byte("#!/bin/sh\n"),
		0o700,
	); err != nil { //nolint:gosec // test fixture
		t.Fatalf("write %s: %v", name, err)
	}
}

func TestCompleteCommands_PrefixFiltersExecutables(t *testing.T) {
	fakeBinDir(t, "git", "gitk", "grep")
	got := completeCommands("/bin/zsh", "gi")
	if !reflect.DeepEqual(got, []string{"git", "gitk"}) {
		t.Errorf("got %q, want [git gitk]", got)
	}
	got = completeCommands("/bin/zsh", "gz")
	if got == nil || len(got) != 0 {
		t.Errorf("non-executable file: got %v, want an empty, non-nil slice", got)
	}
	got = completeCommands("/bin/zsh", "gd")
	if len(got) != 0 {
		t.Errorf("directory on PATH: got %q, want nothing", got)
	}
}

func TestCompleteCommands_EmptyPrefixIsEmpty(t *testing.T) {
	fakeBinDir(t, "git")
	got := completeCommands("/bin/zsh", "")
	if got == nil || len(got) != 0 {
		t.Errorf("got %v, want an empty, non-nil slice", got)
	}
}

func TestCompleteCommands_IsCaseInsensitive(t *testing.T) {
	fakeBinDir(t, "git", "Gimp")
	got := completeCommands("/bin/zsh", "GI")
	if !reflect.DeepEqual(got, []string{"Gimp", "git"}) {
		t.Errorf("got %q, want [Gimp git]", got)
	}
}

func TestCompleteCommands_IncludesBuiltinsAndDedupes(t *testing.T) {
	fakeBinDir(t, "echo", "ecuador")
	got := completeCommands("/bin/bash", "ec")
	if !reflect.DeepEqual(got, []string{"echo", "ecuador"}) {
		t.Errorf("got %q, want [echo ecuador] (builtin echo and /bin/echo merged into one)", got)
	}
	if got := completeCommands("/bin/zsh", "seto"); !slices.Contains(got, "setopt") {
		t.Errorf("zsh builtins missing: got %q, want setopt", got)
	}
	if got := completeCommands("/usr/local/bin/fish", "abb"); !slices.Contains(got, "abbr") {
		t.Errorf("fish builtins missing: got %q, want abbr", got)
	}
	if got := completeCommands(
		`C:\Program Files\PowerShell\7\pwsh.exe`,
		"get-chi",
	); !slices.Contains(
		got,
		"Get-ChildItem",
	) {
		t.Errorf("pwsh cmdlets missing: got %q, want Get-ChildItem", got)
	}
	if got := completeCommands(`C:\Windows\System32\cmd.exe`, "di"); !slices.Contains(got, "dir") {
		t.Errorf("cmd builtins missing: got %q, want dir", got)
	}
}

func TestCompleteCommands_CapsAtMaxCommandCompletions(t *testing.T) {
	execs := make([]string, 0, maxCommandCompletions+10)
	for i := range maxCommandCompletions + 10 {
		execs = append(execs, fmt.Sprintf("x%03d", i))
	}
	fakeBinDir(t, execs...)
	got := completeCommands("/bin/sh", "x")
	if len(got) != maxCommandCompletions {
		t.Errorf("len = %d, want %d", len(got), maxCommandCompletions)
	}
	if !slices.IsSorted(got) {
		t.Error("result is not sorted")
	}
}

func TestCompleteCommands_CachesScanPerShell(t *testing.T) {
	dir := fakeBinDir(t, "git")
	if got := completeCommands("/bin/zsh", "gi"); !reflect.DeepEqual(got, []string{"git"}) {
		t.Fatalf("got %q, want [git]", got)
	}
	// A tool installed after the scan is invisible until the TTL expires.
	writeExecutable(t, dir, "gitui")
	if got := completeCommands("/bin/zsh", "gi"); !reflect.DeepEqual(got, []string{"git"}) {
		t.Errorf("got %q, want the cached [git]", got)
	}
	commandCache.reset()
	if got := completeCommands("/bin/zsh", "gi"); !reflect.DeepEqual(got, []string{"git", "gitui"}) {
		t.Errorf("after reset: got %q, want [git gitui]", got)
	}
}

func TestScanExecutables_DedupesDirectoriesAndSkipsUnreadable(t *testing.T) {
	dir := t.TempDir()
	writeExecutable(t, dir, "tool")
	list := strings.Join([]string{dir, dir, filepath.Join(dir, "missing"), ""}, string(os.PathListSeparator))
	if got := scanExecutables(list); !reflect.DeepEqual(got, []string{"tool"}) {
		t.Errorf("got %q, want [tool]", got)
	}
}

func TestExtractSentinelValue(t *testing.T) {
	out := "Welcome banner\n" + shellPathSentinel + "/usr/bin:/bin" + shellPathSentinel + "trailing noise"
	if got, ok := extractSentinelValue(out, shellPathSentinel); !ok || got != "/usr/bin:/bin" {
		t.Errorf("got %q/%v, want /usr/bin:/bin", got, ok)
	}
	if _, ok := extractSentinelValue("no sentinel here", shellPathSentinel); ok {
		t.Error("expected ok=false without sentinels")
	}
	if _, ok := extractSentinelValue(shellPathSentinel+"unterminated", shellPathSentinel); ok {
		t.Error("expected ok=false with a single sentinel")
	}
}

func TestResolveShellPath_FallsBackToProcessPATHForNonPOSIXShells(t *testing.T) {
	t.Setenv("PATH", "/fake/bin")
	for _, shell := range []string{"pwsh", `C:\Windows\System32\cmd.exe`, ""} {
		if got := resolveShellPath(shell); got != "/fake/bin" {
			t.Errorf("resolveShellPath(%q) = %q, want the process PATH", shell, got)
		}
	}
	// A shell binary that doesn't exist can't be probed either.
	if got := resolveShellPath(filepath.Join(t.TempDir(), "no-such-shell")); got != "/fake/bin" {
		t.Errorf("missing shell: got %q, want the process PATH", got)
	}
}

func TestResolveShellPath_AsksTheLoginShell(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("login-shell probing is skipped on Windows")
	}
	if _, err := os.Stat("/bin/sh"); err != nil {
		t.Skip("/bin/sh not present")
	}
	t.Setenv("PATH", "/fake/bin")
	got := resolveShellPath("/bin/sh")
	if !strings.HasSuffix(got, ":/fake/bin") {
		t.Errorf("got %q, want the shell's PATH joined with the process PATH", got)
	}
	if strings.Contains(got, shellPathSentinel) {
		t.Errorf("sentinel leaked into the result: %q", got)
	}
}

func TestSessionCwd_FallsBackToHomeWithoutTerminalService(t *testing.T) {
	previous := terminalSvc
	terminalSvc = nil
	t.Cleanup(func() { terminalSvc = previous })

	home, _ := os.UserHomeDir()
	if got := sessionCwd(""); got != home {
		t.Errorf("sessionCwd = %q, want home %q", got, home)
	}
}
