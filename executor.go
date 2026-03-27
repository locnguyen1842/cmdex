package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
)

const (
	maxStoredOutputBytes = 8 * 1024 // 8KB cap for persisted output
	defaultExecTimeout   = 60 * time.Second
)

type Executor struct {
	shell    string
	flag     string
	tmpFiles []string // temp files created by OpenInTerminal for cleanup
	tmpMu    sync.Mutex
}

func NewExecutor() *Executor {
	var shell, flag string

	if runtime.GOOS == "windows" {
		shell = "cmd"
		flag = "/C"
	} else {
		shell = os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/sh"
		}
		flag = "-lc"
	}

	return &Executor{shell: shell, flag: flag}
}

// writeTempScript writes script content to a temp file and returns its path.
func writeTempScript(content string) (string, error) {
	f, err := os.CreateTemp("", "commamer-*.sh")
	if err != nil {
		return "", err
	}
	if _, err := f.WriteString(content); err != nil {
		f.Close()
		os.Remove(f.Name())
		return "", err
	}
	if err := f.Close(); err != nil {
		os.Remove(f.Name())
		return "", err
	}
	return f.Name(), nil
}

// BuildFinalCommand builds a display string showing the variable values used.
func BuildFinalCommand(variables map[string]string) string {
	if len(variables) == 0 {
		return "bash <script>"
	}
	parts := []string{"bash <script>"}
	for k, v := range variables {
		parts = append(parts, fmt.Sprintf("%s=%q", k, v))
	}
	return strings.Join(parts, " ")
}

// OutputChunk represents a single chunk of streaming output
type OutputChunk struct {
	Stream string `json:"stream"` // "stdout" or "stderr"
	Data   string `json:"data"`
}

// ExecuteScript runs a resolved script (all {{var}} already replaced) and streams output via callback.
func (e *Executor) ExecuteScript(scriptContent string, onChunk func(OutputChunk)) ExecutionResult {
	tmpPath, err := writeTempScript(scriptContent)
	if err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}
	defer os.Remove(tmpPath)

	ctx, cancel := context.WithTimeout(context.Background(), defaultExecTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "bash", tmpPath)

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}

	if err := cmd.Start(); err != nil {
		return ExecutionResult{Error: err.Error(), ExitCode: -1}
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var outputBuf, errorBuf strings.Builder
	outputCapped, errorCapped := false, false

	streamReader := func(pipe io.Reader, stream string, buf *strings.Builder, capped *bool) {
		defer wg.Done()
		scanner := bufio.NewScanner(pipe)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text() + "\n"
			onChunk(OutputChunk{Stream: stream, Data: line})

			mu.Lock()
			if !*capped {
				if buf.Len()+len(line) > maxStoredOutputBytes {
					remaining := maxStoredOutputBytes - buf.Len()
					if remaining > 0 {
						buf.WriteString(line[:remaining])
					}
					buf.WriteString("\n... [output truncated] ...\n")
					*capped = true
				} else {
					buf.WriteString(line)
				}
			}
			mu.Unlock()
		}
	}

	wg.Add(2)
	go streamReader(stdoutPipe, "stdout", &outputBuf, &outputCapped)
	go streamReader(stderrPipe, "stderr", &errorBuf, &errorCapped)
	wg.Wait()

	waitErr := cmd.Wait()

	result := ExecutionResult{
		Output:   outputBuf.String(),
		ExitCode: 0,
	}
	if errorBuf.Len() > 0 {
		result.Error = errorBuf.String()
	}

	if ctx.Err() == context.DeadlineExceeded {
		onChunk(OutputChunk{Stream: "stderr", Data: fmt.Sprintf("\n[timed out after %s]\n", defaultExecTimeout)})
		if result.Error != "" {
			result.Error += "\n"
		}
		result.Error += fmt.Sprintf("command timed out after %s", defaultExecTimeout)
		result.ExitCode = -1
		return result
	}

	if waitErr != nil {
		if exitErr, ok := waitErr.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			if result.Error == "" {
				result.Error = waitErr.Error()
			}
			result.ExitCode = -1
		}
	}

	return result
}

// CleanupTempFiles removes temp files created by OpenInTerminal.
func (e *Executor) CleanupTempFiles() {
	e.tmpMu.Lock()
	defer e.tmpMu.Unlock()
	for _, f := range e.tmpFiles {
		os.Remove(f)
	}
	e.tmpFiles = nil
}

// OpenInTerminal opens a terminal and runs the resolved script.
func (e *Executor) OpenInTerminal(terminalID string, scriptContent string) error {
	tmpPath, err := writeTempScript(scriptContent)
	if err != nil {
		return err
	}
	// Track temp file for cleanup on shutdown
	e.tmpMu.Lock()
	e.tmpFiles = append(e.tmpFiles, tmpPath)
	e.tmpMu.Unlock()

	cmdText := "bash " + tmpPath

	defs := e.terminalDefs()

	if terminalID != "" {
		for _, d := range defs {
			if d.ID == terminalID && e.terminalExists(d) && d.LaunchFn != nil {
				return d.LaunchFn(e, cmdText)
			}
		}
	}

	for _, d := range defs {
		if e.terminalExists(d) && d.LaunchFn != nil {
			return d.LaunchFn(e, cmdText)
		}
	}
	return fmt.Errorf("no terminal emulator found")
}

// terminalDef defines how to detect and launch a terminal emulator
type terminalDef struct {
	ID       string
	Name     string
	Paths    []string // candidate binary paths or app bundle paths
	IsApp    bool     // macOS .app bundle (use osascript to launch)
	LaunchFn func(e *Executor, cmdText string) error
}

// GetAvailableTerminals returns all terminal emulators detected on the current system.
func (e *Executor) GetAvailableTerminals() []TerminalInfo {
	defs := e.terminalDefs()
	var result []TerminalInfo
	for _, d := range defs {
		if e.terminalExists(d) {
			result = append(result, TerminalInfo{ID: d.ID, Name: d.Name})
		}
	}
	if result == nil {
		result = []TerminalInfo{}
	}
	return result
}

func (e *Executor) terminalExists(d terminalDef) bool {
	for _, p := range d.Paths {
		if d.IsApp {
			if _, err := os.Stat(p); err == nil {
				return true
			}
		} else {
			if _, err := exec.LookPath(p); err == nil {
				return true
			}
		}
	}
	return false
}

func (e *Executor) terminalDefs() []terminalDef {
	switch runtime.GOOS {
	case "darwin":
		return e.darwinTerminals()
	case "linux":
		return e.linuxTerminals()
	case "windows":
		return e.windowsTerminals()
	}
	return nil
}

func (e *Executor) darwinTerminals() []terminalDef {
	osa := func(appName, script string) func(*Executor, string) error {
		return func(_ *Executor, cmdText string) error {
			escaped := strings.ReplaceAll(cmdText, `\`, `\\`)
			escaped = strings.ReplaceAll(escaped, `"`, `\"`)
			s := fmt.Sprintf(script, escaped)
			return exec.Command("osascript", "-e", s).Start()
		}
	}

	return []terminalDef{
		{
			ID: "terminal", Name: "Terminal", Paths: []string{"/System/Applications/Utilities/Terminal.app"}, IsApp: true,
			LaunchFn: osa("Terminal", `tell application "Terminal"
	do script "%s"
	activate
end tell`),
		},
		{
			ID: "iterm2", Name: "iTerm2", Paths: []string{"/Applications/iTerm.app"}, IsApp: true,
			LaunchFn: osa("iTerm2", `tell application "iTerm2"
	create window with default profile
	tell current session of current window
		write text "%s"
	end tell
	activate
end tell`),
		},
		{
			ID: "warp", Name: "Warp", Paths: []string{"/Applications/Warp.app"}, IsApp: true,
			LaunchFn: func(_ *Executor, cmdText string) error {
				escaped := strings.ReplaceAll(cmdText, `\`, `\\`)
				escaped = strings.ReplaceAll(escaped, `"`, `\"`)
				s := fmt.Sprintf(`tell application "Warp" to activate
delay 0.5
tell application "System Events" to keystroke "%s"
tell application "System Events" to key code 36`, escaped)
				return exec.Command("osascript", "-e", s).Start()
			},
		},
		{
			ID: "alacritty", Name: "Alacritty", Paths: []string{"alacritty", "/Applications/Alacritty.app"}, IsApp: false,
			LaunchFn: func(ex *Executor, cmdText string) error {
				return exec.Command("alacritty", "-e", ex.shell, "-lc", cmdText+"; exec "+ex.shell).Start()
			},
		},
		{
			ID: "kitty", Name: "Kitty", Paths: []string{"kitty", "/Applications/kitty.app"}, IsApp: false,
			LaunchFn: func(ex *Executor, cmdText string) error {
				return exec.Command("kitty", ex.shell, "-lc", cmdText+"; exec "+ex.shell).Start()
			},
		},
		{
			ID: "ghostty", Name: "Ghostty", Paths: []string{"ghostty", "/Applications/Ghostty.app"}, IsApp: false,
			LaunchFn: func(ex *Executor, cmdText string) error {
				return exec.Command("ghostty", "-e", ex.shell, "-lc", cmdText+"; exec "+ex.shell).Start()
			},
		},
		{
			ID: "hyper", Name: "Hyper", Paths: []string{"/Applications/Hyper.app"}, IsApp: true,
			LaunchFn: func(_ *Executor, cmdText string) error {
				return exec.Command("open", "-a", "Hyper").Start()
			},
		},
	}
}

func (e *Executor) linuxTerminals() []terminalDef {
	shellExec := func(bin string, buildArgs func(string, string) []string) func(*Executor, string) error {
		return func(ex *Executor, cmdText string) error {
			args := buildArgs(ex.shell, cmdText)
			return exec.Command(bin, args...).Start()
		}
	}

	return []terminalDef{
		{ID: "gnome-terminal", Name: "GNOME Terminal", Paths: []string{"gnome-terminal"},
			LaunchFn: shellExec("gnome-terminal", func(sh, cmd string) []string {
				return []string{"--", sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "gnome-console", Name: "GNOME Console", Paths: []string{"kgx"},
			LaunchFn: shellExec("kgx", func(sh, cmd string) []string {
				return []string{"-e", sh + ` -c '` + cmd + "; exec " + sh + `'`}
			})},
		{ID: "konsole", Name: "Konsole", Paths: []string{"konsole"},
			LaunchFn: shellExec("konsole", func(sh, cmd string) []string {
				return []string{"-e", sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "xfce4-terminal", Name: "XFCE Terminal", Paths: []string{"xfce4-terminal"},
			LaunchFn: shellExec("xfce4-terminal", func(sh, cmd string) []string {
				return []string{"-e", sh + " -c '" + cmd + "; exec " + sh + "'"}
			})},
		{ID: "alacritty", Name: "Alacritty", Paths: []string{"alacritty"},
			LaunchFn: shellExec("alacritty", func(sh, cmd string) []string {
				return []string{"-e", sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "kitty", Name: "Kitty", Paths: []string{"kitty"},
			LaunchFn: shellExec("kitty", func(sh, cmd string) []string {
				return []string{sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "ghostty", Name: "Ghostty", Paths: []string{"ghostty"},
			LaunchFn: shellExec("ghostty", func(sh, cmd string) []string {
				return []string{"-e", sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "xterm", Name: "XTerm", Paths: []string{"xterm"},
			LaunchFn: shellExec("xterm", func(sh, cmd string) []string {
				return []string{"-e", sh, "-c", cmd + "; exec " + sh}
			})},
	}
}

func (e *Executor) windowsTerminals() []terminalDef {
	return []terminalDef{
		{ID: "windows-terminal", Name: "Windows Terminal", Paths: []string{"wt"},
			LaunchFn: func(_ *Executor, cmdText string) error {
				return exec.Command("wt", "cmd", "/k", cmdText).Start()
			}},
		{ID: "cmd", Name: "Command Prompt", Paths: []string{"cmd"},
			LaunchFn: func(_ *Executor, cmdText string) error {
				return exec.Command("cmd", "/c", "start", "cmd", "/k", cmdText).Start()
			}},
		{ID: "pwsh", Name: "PowerShell", Paths: []string{"pwsh", "powershell"},
			LaunchFn: func(_ *Executor, cmdText string) error {
				bin := "powershell"
				if _, err := exec.LookPath("pwsh"); err == nil {
					bin = "pwsh"
				}
				return exec.Command(bin, "-NoExit", "-Command", cmdText).Start()
			}},
	}
}

// EvalDefaults evaluates CEL expressions in variable definitions and returns resolved defaults.
func (e *Executor) EvalDefaults(defs []VariableDefinition) map[string]string {
	results := make(map[string]string, len(defs))
	if len(defs) == 0 {
		return results
	}

	env, err := cel.NewEnv(
		cel.Function("now",
			cel.Overload("now_void", nil, cel.StringType,
				cel.FunctionBinding(func(args ...ref.Val) ref.Val {
					return types.String(time.Now().Format(time.RFC3339))
				}),
			),
		),
		cel.Function("env",
			cel.Overload("env_string", []*cel.Type{cel.StringType}, cel.StringType,
				cel.UnaryBinding(func(val ref.Val) ref.Val {
					key := string(val.(types.String))
					return types.String(os.Getenv(key))
				}),
			),
		),
		cel.Function("date",
			cel.Overload("date_string", []*cel.Type{cel.StringType}, cel.StringType,
				cel.UnaryBinding(func(val ref.Val) ref.Val {
					layout := string(val.(types.String))
					return types.String(time.Now().Format(layout))
				}),
			),
		),
	)
	if err != nil {
		for _, d := range defs {
			results[d.Name] = d.Default
		}
		return results
	}

	for _, d := range defs {
		if d.Default == "" {
			results[d.Name] = ""
			continue
		}

		ast, issues := env.Compile(d.Default)
		if issues != nil && issues.Err() != nil {
			results[d.Name] = d.Default
			continue
		}

		prg, err := env.Program(ast)
		if err != nil {
			results[d.Name] = d.Default
			continue
		}

		out, _, err := prg.Eval(cel.NoVars())
		if err != nil {
			results[d.Name] = d.Default
			continue
		}

		results[d.Name] = fmt.Sprintf("%v", out.Value())
	}

	return results
}
