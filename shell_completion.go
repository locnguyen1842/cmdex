package main

import (
	"cmp"
	"context"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"time"
)

// Path and command completion for the terminal's Warp-style completion menu
// (SuggestionService.CompletePath / CompleteCommands, rendered by
// frontend/src/components/Terminal.tsx). Both are read-style: they never
// error to the frontend and always return a non-nil slice.
//
// Path completion needs to know where the shell IS, not where it was
// started — that's the live OSC 7 report decoded by terminal_capture.go
// (sessionCwd). Command completion needs the shell's real PATH, which is
// not the app's own: a GUI app started by launchd/Finder inherits a minimal
// PATH with none of the user's Homebrew/nvm/cargo directories, so the
// login shell is asked for its PATH once and the scan is cached.

const (
	maxPathCompletions    = 50
	maxCommandCompletions = 50

	// commandCacheTTL is how long a shell's scanned executable list is
	// reused before PATH is re-resolved and re-scanned (lazily, on the next
	// request after expiry) so a freshly installed tool shows up eventually
	// without stat-ing every PATH directory on every keystroke.
	commandCacheTTL = 60 * time.Second

	// shellPathProbeTimeout bounds the login-shell round trip that resolves
	// the shell's real PATH. A profile that blocks (prompting, waiting on a
	// network mount) must not hang completion; the app's own PATH is used
	// instead.
	shellPathProbeTimeout = 3 * time.Second

	// shellPathSentinel brackets the PATH value in the probe's stdout so
	// anything the user's profile prints during login (a fortune, a
	// version-manager banner) can't pollute it.
	shellPathSentinel = "__CMDEX_PATH__"

	// execBits is the union of the owner/group/other execute permission
	// bits — a regular file with any of them set counts as a command.
	execBits = 0o111
)

// posixWordSpecials are the characters a POSIX shell gives meaning to in an
// unquoted word, each backslash-escaped in an unquoted Insert: whitespace,
// quoting, expansion, redirection, control operators, globbing, and
// comments.
const posixWordSpecials = " \t\"'$&()[]{};|<>`\\*?!#"

// windowsQuoteTriggers are the characters that make a PowerShell/cmd.exe
// token need quoting as a whole (neither shell has backslash escaping —
// backslash is the path separator).
const windowsQuoteTriggers = " \t$&(){};,|<>'\"`@#"

// sessionCwd returns the session shell's current working directory as last
// reported via OSC 7 by shell integration, falling back to the directory the
// session was started in, then the home directory (a session that hasn't
// started yet, an unknown ID, or no terminal service at all).
func sessionCwd(sessionID string) string {
	if terminalSvc != nil {
		if ss, err := terminalSvc.resolveSession(sessionID); err == nil {
			if cwd := ss.liveCwd(); cwd != "" {
				return cwd
			}
			ss.mu.Lock()
			dir := ss.workingDir
			ss.mu.Unlock()
			if dir != "" {
				return dir
			}
		}
	}
	home, _ := os.UserHomeDir()
	return home
}

// ========== Path completion ==========

// completionToken is the user's partial path argument split into the parts
// completion needs.
type completionToken struct {
	// quote is the quote character the user opened the token with ("" if
	// none). It is kept and closed again in every Insert.
	quote string
	// dirTyped is the directory part exactly as typed (after any opening
	// quote), including its trailing separator, so Insert can preserve
	// whatever spelling the user chose ("~/", "../", a backslash-escaped
	// space, ...).
	dirTyped string
	// dir is dirTyped with shell escapes removed — what the filesystem is
	// asked about.
	dir string
	// prefix is the final segment with shell escapes removed — what entry
	// names must start with.
	prefix string
	// sep is the separator appended to a completed directory: "/" except on
	// Windows, where it follows the separator the user typed (backslash by
	// default).
	sep string
}

// pathSeparators lists the characters that end a directory part in a typed
// path on this OS.
func pathSeparators() string {
	if runtime.GOOS == "windows" {
		return `/\`
	}
	return "/"
}

// splitCompletionToken parses partial for dialect d. POSIX shells may have
// backslash-escaped the typed text; PowerShell/cmd.exe never do (backslash
// is their path separator), so only quotes are unwrapped for them.
func splitCompletionToken(partial string, d shellDialect) completionToken {
	tok := completionToken{sep: "/"}
	if len(partial) > 0 && (partial[0] == '"' || partial[0] == '\'') {
		tok.quote = partial[:1]
		partial = strings.TrimSuffix(partial[1:], tok.quote)
	}

	seps := pathSeparators()
	idx := strings.LastIndexAny(partial, seps)
	// A backslash-escaped "/" can't happen in a real path, but a POSIX
	// token's separators are still found on the raw text: "\ " never
	// contains one, so the split point is the same before and after
	// unescaping.
	tok.dirTyped = partial[:idx+1]
	rawPrefix := partial[idx+1:]

	unescape := func(s string) string { return s }
	if d == dialectPOSIX && tok.quote == "" {
		unescape = unescapePOSIXWord
	}
	tok.dir = unescape(tok.dirTyped)
	tok.prefix = unescape(rawPrefix)

	// A bare "~" completes the home directory itself, as if "~/" were typed.
	if tok.dir == "" && tok.prefix == "~" {
		tok.dirTyped, tok.dir, tok.prefix = "~"+tok.sep, "~"+tok.sep, ""
	}

	if runtime.GOOS == "windows" {
		tok.sep = `\`
		if strings.Contains(tok.dirTyped, "/") && !strings.Contains(tok.dirTyped, `\`) {
			tok.sep = "/"
		}
	}
	return tok
}

// unescapePOSIXWord removes the backslashes a POSIX shell would consume from
// an unquoted word ("My\ Docs" -> "My Docs").
func unescapePOSIXWord(s string) string {
	if !strings.Contains(s, `\`) {
		return s
	}
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+1 < len(s) {
			i++
		}
		b.WriteByte(s[i])
	}
	return b.String()
}

// resolveCompletionDir maps the typed directory part onto a real directory:
// "" is cwd, "~" and "~/..." are the home directory, an absolute path is
// itself, anything else is relative to cwd. ok is false when the home
// directory can't be determined.
func resolveCompletionDir(cwd, dir string) (string, bool) {
	switch {
	case dir == "":
		return cwd, true
	case dir == "~" || strings.HasPrefix(dir, "~/") || (runtime.GOOS == "windows" && strings.HasPrefix(dir, `~\`)):
		home, err := os.UserHomeDir()
		if err != nil {
			return "", false
		}
		return filepath.Join(home, dir[1:]), true
	case filepath.IsAbs(dir):
		return filepath.Clean(dir), true
	default:
		return filepath.Join(cwd, dir), true
	}
}

// dirEntryMatch is one directory entry that passed completion's filters.
type dirEntryMatch struct {
	name  string
	isDir bool
}

// completePath lists the entries of the directory named by partial —
// relative to cwd, with "~" and absolute paths honored — whose names start
// with partial's last path segment: case-insensitively on macOS and Windows
// (case-insensitive filesystems), exactly on Linux. Hidden entries are
// offered only when that segment itself starts with ".". Directories come
// first, then files, each group sorted; dirsOnly drops the files (for cd).
// At most maxPathCompletions entries are returned, and any failure (a
// directory that doesn't exist or can't be read) yields an empty slice.
//
// d selects how Insert is quoted for the session's shell: backslash escapes
// for POSIX shells, single quotes for PowerShell (its own completer's
// choice, since "$" and backticks still interpolate inside double quotes),
// double quotes for cmd.exe. A quote the user already opened is kept and
// closed instead.
func completePath(cwd, partial string, dirsOnly bool, d shellDialect) []PathCompletion {
	tok := splitCompletionToken(partial, d)
	dirPath, ok := resolveCompletionDir(cwd, tok.dir)
	if !ok {
		return []PathCompletion{}
	}
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return []PathCompletion{}
	}

	fold := runtime.GOOS == "darwin" || runtime.GOOS == "windows"
	matchPrefix := tok.prefix
	if fold {
		matchPrefix = strings.ToLower(matchPrefix)
	}
	showHidden := strings.HasPrefix(tok.prefix, ".")

	var dirs, files []dirEntryMatch
	for _, e := range entries {
		name := e.Name()
		if !showHidden && strings.HasPrefix(name, ".") {
			continue
		}
		candidate := name
		if fold {
			candidate = strings.ToLower(candidate)
		}
		if !strings.HasPrefix(candidate, matchPrefix) {
			continue
		}
		isDir := e.IsDir()
		if !isDir && e.Type()&os.ModeSymlink != 0 {
			// A symlink to a directory is a directory for the user's
			// purposes (they can keep drilling down), which only Stat —
			// following the link — can tell.
			if info, statErr := os.Stat(filepath.Join(dirPath, name)); statErr == nil {
				isDir = info.IsDir()
			}
		}
		if isDir {
			dirs = append(dirs, dirEntryMatch{name: name, isDir: true})
		} else if !dirsOnly {
			files = append(files, dirEntryMatch{name: name})
		}
	}
	sortEntryMatches(dirs)
	sortEntryMatches(files)

	matches := slices.Concat(dirs, files)
	if len(matches) > maxPathCompletions {
		matches = matches[:maxPathCompletions]
	}
	out := make([]PathCompletion, 0, len(matches))
	for _, m := range matches {
		name := m.name
		if m.isDir {
			name += "/"
		}
		out = append(out, PathCompletion{
			Name:   name,
			Insert: renderInsert(tok, m, d),
			IsDir:  m.isDir,
		})
	}
	return out
}

// sortEntryMatches orders entries case-insensitively (the way Finder and
// Explorer list them), falling back to a byte-wise comparison so names that
// differ only by case still sort deterministically.
func sortEntryMatches(entries []dirEntryMatch) {
	slices.SortFunc(entries, func(a, b dirEntryMatch) int {
		if c := cmp.Compare(strings.ToLower(a.name), strings.ToLower(b.name)); c != 0 {
			return c
		}
		return cmp.Compare(a.name, b.name)
	})
}

// renderInsert builds the full replacement for the token being completed:
// the typed directory part verbatim, then the entry name, then the
// separator for a directory — quoted or escaped for dialect d (see
// completePath).
func renderInsert(tok completionToken, m dirEntryMatch, d shellDialect) string {
	tail := ""
	if m.isDir {
		tail = tok.sep
	}
	if tok.quote != "" {
		return tok.quote + tok.dirTyped + escapeInsideQuotes(m.name, tok.quote, d) + tail + tok.quote
	}
	if d == dialectPOSIX {
		return tok.dirTyped + escapePOSIXWord(m.name, tok.dirTyped == "") + tail
	}
	token := tok.dirTyped + m.name + tail
	if !strings.ContainsAny(token, windowsQuoteTriggers) {
		return token
	}
	quote := `"`
	if d == dialectPowerShell {
		quote = "'"
	}
	return quote + escapeInsideQuotes(token, quote, d) + quote
}

// escapePOSIXWord backslash-escapes every character of name a POSIX shell
// would otherwise interpret in an unquoted word. atWordStart additionally
// escapes a leading "~", which only expands there.
func escapePOSIXWord(name string, atWordStart bool) string {
	var b strings.Builder
	b.Grow(len(name))
	for i := range len(name) {
		c := name[i]
		if strings.IndexByte(posixWordSpecials, c) >= 0 || (atWordStart && i == 0 && c == '~') {
			b.WriteByte('\\')
		}
		b.WriteByte(c)
	}
	return b.String()
}

// escapeInsideQuotes escapes s for placement inside a quote-delimited token
// of dialect d. Single quotes are literal in every shell except for the
// quote itself (POSIX: '\” ; PowerShell: doubled); double quotes still
// interpolate in POSIX shells ("\", `"`, "$", backtick) and PowerShell
// (backtick-escaped `"`, "$" and backtick). cmd.exe has no escaping at all
// inside quotes, so s is returned as is.
func escapeInsideQuotes(s, quote string, d shellDialect) string {
	switch {
	case d == dialectCmd:
		return s
	case quote == "'" && d == dialectPOSIX:
		return strings.ReplaceAll(s, "'", `'\''`)
	case quote == "'":
		return strings.ReplaceAll(s, "'", "''")
	case d == dialectPOSIX:
		return strings.NewReplacer(`\`, `\\`, `"`, `\"`, "$", `\$`, "`", "\\`").Replace(s)
	default:
		return strings.NewReplacer("`", "``", `"`, "`\"", "$", "`$").Replace(s)
	}
}

// ========== Command completion ==========

// commandListCache memoizes the executables found on each shell's PATH,
// keyed by shell binary (different shells can resolve different PATHs).
type commandListCache struct {
	mu      sync.Mutex
	entries map[string]cachedCommandList
}

type cachedCommandList struct {
	names   []string
	fetched time.Time
}

// commandCache is the process-wide executable cache behind completeCommands.
var commandCache = &commandListCache{entries: map[string]cachedCommandList{}}

// shellPathResolver resolves the PATH the session shell actually uses. A
// package-level variable so tests can substitute a fixed directory list
// instead of spawning a login shell.
var shellPathResolver = resolveShellPath

// get returns the sorted, deduplicated executable names on shellPath's PATH,
// rescanning once commandCacheTTL has elapsed. The lock is held across the
// scan on purpose: a burst of keystrokes during the first (slow, login-shell
// spawning) resolution must share one probe rather than each launching
// their own.
func (c *commandListCache) get(shellPath string) []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if cached, ok := c.entries[shellPath]; ok && time.Since(cached.fetched) < commandCacheTTL {
		return cached.names
	}
	names := scanExecutables(shellPathResolver(shellPath))
	c.entries[shellPath] = cachedCommandList{names: names, fetched: time.Now()}
	return names
}

// reset drops every cached list; the next request rescans.
func (c *commandListCache) reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = map[string]cachedCommandList{}
}

// completeCommands lists the executables on shellPath's PATH plus that
// shell's builtins whose names start with prefix (case-insensitively),
// deduplicated and sorted, at most maxCommandCompletions of them. An empty
// prefix yields nothing: every command on the system is not a useful menu.
func completeCommands(shellPath, prefix string) []string {
	if prefix == "" {
		return []string{}
	}
	lower := strings.ToLower(prefix)
	seen := make(map[string]struct{})
	out := []string{}
	for _, name := range slices.Concat(shellBuiltins(shellPath), commandCache.get(shellPath)) {
		if !strings.HasPrefix(strings.ToLower(name), lower) {
			continue
		}
		if _, dup := seen[name]; dup {
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	slices.Sort(out)
	if len(out) > maxCommandCompletions {
		out = out[:maxCommandCompletions]
	}
	return out
}

// resolveShellPath returns the PATH list to scan for shellPath: the login
// shell's own PATH (asked for via `<shell> -l -c ...`, bounded by
// shellPathProbeTimeout) joined with the app's, or just the app's when the
// probe fails, times out, or the shell has no POSIX-style -c (PowerShell,
// cmd.exe, and everything on Windows, where the app's PATH is the system
// one anyway). -i is deliberately not passed: an interactive login shell
// can block on a tty it doesn't have, and PATH is set by profile files that
// -l alone already sources.
func resolveShellPath(shellPath string) string {
	fallback := os.Getenv("PATH")
	if runtime.GOOS == "windows" {
		return fallback
	}
	var probe string
	switch shellBaseName(shellPath) {
	case "fish":
		// $PATH is a list in fish; "$PATH" would join it with spaces.
		probe = "string join : $PATH"
	case "pwsh", "powershell", "cmd", "":
		return fallback
	default:
		probe = `printf '%s' "$PATH"`
	}
	script := "printf '%s' '" + shellPathSentinel + "'; " + probe + "; printf '%s' '" + shellPathSentinel + "'"

	ctx, cancel := context.WithTimeout(context.Background(), shellPathProbeTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, shellPath, "-l", "-c", script).Output()
	if err != nil {
		return fallback
	}
	shellPATH, ok := extractSentinelValue(string(out), shellPathSentinel)
	if !ok || shellPATH == "" {
		return fallback
	}
	return shellPATH + string(os.PathListSeparator) + fallback
}

// extractSentinelValue returns the text between the first two occurrences
// of sentinel in output.
func extractSentinelValue(output, sentinel string) (string, bool) {
	_, rest, ok := strings.Cut(output, sentinel)
	if !ok {
		return "", false
	}
	value, _, ok := strings.Cut(rest, sentinel)
	if !ok {
		return "", false
	}
	return value, true
}

// scanExecutables walks every directory in pathList (an os.PathListSeparator-
// separated list, duplicates and unreadable entries skipped) and returns the
// sorted, deduplicated names of the executables found.
func scanExecutables(pathList string) []string {
	seenDir := make(map[string]struct{})
	names := make(map[string]struct{})
	exts := windowsExecutableExts()
	for _, dir := range filepath.SplitList(pathList) {
		if dir == "" {
			continue
		}
		if _, dup := seenDir[dir]; dup {
			continue
		}
		seenDir[dir] = struct{}{}
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if name, ok := executableName(dir, e, exts); ok {
				names[name] = struct{}{}
			}
		}
	}
	return slices.Sorted(maps.Keys(names))
}

// windowsExecutableExts returns the lower-cased extensions (with their dot)
// that make a file a command on Windows — %PATHEXT%, or cmd.exe's default
// set when unset — and nil elsewhere.
func windowsExecutableExts() []string {
	if runtime.GOOS != "windows" {
		return nil
	}
	pathext := os.Getenv("PATHEXT")
	if pathext == "" {
		pathext = ".COM;.EXE;.BAT;.CMD"
	}
	var exts []string
	for ext := range strings.SplitSeq(strings.ToLower(pathext), ";") {
		if ext != "" {
			exts = append(exts, ext)
		}
	}
	return exts
}

// executableName reports whether the directory entry e in dir is a command
// the shell would run by name, and that name. On Windows that means a file
// carrying one of the exts extensions (returned without it, since that's
// how it's typed); elsewhere a regular file — following symlinks — with an
// execute bit set.
func executableName(dir string, e os.DirEntry, exts []string) (string, bool) {
	if e.IsDir() {
		return "", false
	}
	if runtime.GOOS == "windows" {
		ext := filepath.Ext(e.Name())
		if slices.Contains(exts, strings.ToLower(ext)) {
			return strings.TrimSuffix(e.Name(), ext), true
		}
		return "", false
	}
	var info os.FileInfo
	var err error
	if e.Type()&os.ModeSymlink != 0 {
		info, err = os.Stat(filepath.Join(dir, e.Name()))
	} else {
		info, err = e.Info()
	}
	if err != nil || !info.Mode().IsRegular() || info.Mode()&execBits == 0 {
		return "", false
	}
	return e.Name(), true
}

// ========== Builtins ==========

// posixBuiltins are the builtins bash, zsh and every other POSIX-style
// shell share (plus a few shell keywords a user types like commands).
var posixBuiltins = []string{
	"alias", "bg", "break", "builtin", "case", "cd", "command", "continue", "do", "done", "echo", "elif",
	"else", "esac", "eval", "exec", "exit", "export", "false", "fg", "fi", "for", "getopts", "hash",
	"history", "if", "jobs", "kill", "local", "printf", "pwd", "read", "readonly", "return", "set",
	"shift", "source", "test", "then", "times", "trap", "true", "type", "ulimit", "umask", "unalias",
	"unset", "until", "wait", "which", "while",
}

var bashBuiltins = []string{
	"bind", "caller", "compgen", "complete", "declare", "dirs", "disown", "enable", "help", "let", "logout",
	"mapfile", "popd", "pushd", "readarray", "select", "shopt", "suspend", "typeset",
}

var zshBuiltins = []string{
	"autoload", "bindkey", "compdef", "declare", "dirs", "disable", "disown", "emulate", "enable", "fc",
	"float", "functions", "integer", "let", "noglob", "popd", "print", "pushd", "rehash", "select",
	"setopt", "typeset", "unfunction", "unhash", "unsetopt", "vared", "whence", "where", "zle", "zmodload",
	"zstyle",
}

var fishBuiltins = []string{
	"abbr", "and", "argparse", "begin", "bind", "block", "breakpoint", "builtin", "case", "cd", "command",
	"commandline", "complete", "contains", "count", "disown", "echo", "else", "emit", "end", "eval",
	"exec", "exit", "false", "fg", "for", "funced", "funcsave", "function", "functions", "history", "if",
	"isatty", "jobs", "kill", "math", "not", "or", "path", "printf", "pwd", "random", "read", "realpath",
	"return", "set", "source", "status", "string", "switch", "test", "true", "type", "ulimit", "umask",
	"wait", "which", "while",
}

var pwshBuiltins = []string{
	"Add-Content", "Clear-Host", "Compare-Object", "Copy-Item", "ForEach-Object", "Format-List",
	"Format-Table", "Get-Alias", "Get-ChildItem", "Get-Command", "Get-Content", "Get-Date", "Get-Help",
	"Get-History", "Get-Item", "Get-Location", "Get-Member", "Get-Module", "Get-Process", "Get-Service",
	"Get-Variable", "Import-Module", "Invoke-Expression", "Invoke-RestMethod", "Invoke-WebRequest",
	"Join-Path", "Measure-Object", "Move-Item", "New-Item", "Out-File", "Pop-Location", "Push-Location",
	"Remove-Item", "Rename-Item", "Resolve-Path", "Select-Object", "Select-String", "Set-Alias",
	"Set-Content", "Set-Item", "Set-Location", "Set-Variable", "Sort-Object", "Split-Path",
	"Start-Process", "Stop-Process", "Test-Path", "Where-Object", "Write-Host", "Write-Output",
	// Aliases people actually type.
	"cat", "cd", "clear", "cls", "cp", "dir", "echo", "exit", "gc", "gci", "gcm", "history", "iex", "irm",
	"iwr", "kill", "ls", "man", "mkdir", "mv", "ps", "pwd", "rm", "rmdir", "select", "sort", "type",
	"where",
}

var cmdBuiltins = []string{
	"assoc", "call", "cd", "chdir", "cls", "color", "copy", "date", "del", "dir", "echo", "erase", "exit",
	"for", "ftype", "goto", "if", "md", "mkdir", "move", "path", "popd", "prompt", "pushd", "rd", "ren",
	"rename", "rmdir", "set", "start", "time", "title", "type", "ver", "vol",
}

// shellBuiltins returns the static builtin list for shellPath's family:
// POSIX shells get the shared set plus their own extras, fish/PowerShell/
// cmd.exe their own. Unrecognized shells are treated as POSIX.
func shellBuiltins(shellPath string) []string {
	switch shellBaseName(shellPath) {
	case "bash":
		return slices.Concat(posixBuiltins, bashBuiltins)
	case "zsh":
		return slices.Concat(posixBuiltins, zshBuiltins)
	case "fish":
		return fishBuiltins
	case "pwsh", "powershell":
		return pwshBuiltins
	case "cmd":
		return cmdBuiltins
	default:
		return posixBuiltins
	}
}
