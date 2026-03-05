package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
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

var variableRegex = regexp.MustCompile(`\$\{(\w+)\}`)

type Executor struct {
	shell string
	flag  string
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

		fmt.Println("shell", shell)
		flag = "-lc"
	}

	return &Executor{shell: shell, flag: flag}
}

// ParseVariables extracts variable placeholders from command text
// Placeholders use the format ${variableName}
func (e *Executor) ParseVariables(cmdText string) []VariablePrompt {
	matches := variableRegex.FindAllStringSubmatch(cmdText, -1)
	seen := make(map[string]bool)
	var prompts []VariablePrompt

	for _, match := range matches {
		name := match[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		prompts = append(prompts, VariablePrompt{
			Name:        name,
			Placeholder: match[0],
		})
	}

	if prompts == nil {
		prompts = []VariablePrompt{}
	}
	return prompts
}

// SubstituteVariables replaces ${var} placeholders with provided values
func (e *Executor) SubstituteVariables(cmdText string, variables map[string]string) string {
	result := cmdText
	for name, value := range variables {
		result = strings.ReplaceAll(result, "${"+name+"}", value)
	}
	return result
}

// Execute runs a shell command and returns the result (non-streaming, kept for backward compatibility)
func (e *Executor) Execute(cmdText string) ExecutionResult {
	ctx, cancel := context.WithTimeout(context.Background(), defaultExecTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, e.shell, e.flag, cmdText)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	result := ExecutionResult{
		Output:   stdout.String(),
		ExitCode: 0,
	}

	if stderr.Len() > 0 {
		result.Error = stderr.String()
	}

	if ctx.Err() == context.DeadlineExceeded {
		result.Error = fmt.Sprintf("command timed out after %s", defaultExecTimeout)
		result.ExitCode = -1
		return result
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			result.Error = err.Error()
			result.ExitCode = -1
		}
	}

	return result
}

// OutputChunk represents a single chunk of streaming output
type OutputChunk struct {
	Stream string `json:"stream"` // "stdout" or "stderr"
	Data   string `json:"data"`
}

// ExecuteStreaming runs a shell command and streams output line-by-line via the callback.
// The returned ExecutionResult contains truncated output (capped at maxStoredOutputBytes).
// The command is killed if it exceeds defaultExecTimeout.
func (e *Executor) ExecuteStreaming(cmdText string, onChunk func(OutputChunk)) ExecutionResult {
	ctx, cancel := context.WithTimeout(context.Background(), defaultExecTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, e.shell, e.flag, cmdText)

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
	hold := func(ex *Executor, cmdText string) string {
		return cmdText + "; exec " + ex.shell
	}
	_ = hold

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
		{ID: "mate-terminal", Name: "MATE Terminal", Paths: []string{"mate-terminal"},
			LaunchFn: shellExec("mate-terminal", func(sh, cmd string) []string {
				return []string{"-e", sh + " -c '" + cmd + "; exec " + sh + "'"}
			})},
		{ID: "tilix", Name: "Tilix", Paths: []string{"tilix"},
			LaunchFn: shellExec("tilix", func(sh, cmd string) []string {
				return []string{"-e", sh + " -c '" + cmd + "; exec " + sh + "'"}
			})},
		{ID: "terminator", Name: "Terminator", Paths: []string{"terminator"},
			LaunchFn: shellExec("terminator", func(sh, cmd string) []string {
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
		{ID: "warp", Name: "Warp", Paths: []string{"warp-terminal"},
			LaunchFn: shellExec("warp-terminal", func(_, _ string) []string { return nil })},
		{ID: "ghostty", Name: "Ghostty", Paths: []string{"ghostty"},
			LaunchFn: shellExec("ghostty", func(sh, cmd string) []string {
				return []string{"-e", sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "urxvt", Name: "URxvt", Paths: []string{"urxvt"},
			LaunchFn: shellExec("urxvt", func(sh, cmd string) []string {
				return []string{"-e", sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "xterm", Name: "XTerm", Paths: []string{"xterm"},
			LaunchFn: shellExec("xterm", func(sh, cmd string) []string {
				return []string{"-e", sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "deepin-terminal", Name: "Deepin Terminal", Paths: []string{"deepin-terminal"},
			LaunchFn: shellExec("deepin-terminal", func(sh, cmd string) []string {
				return []string{"-e", sh, "-c", cmd + "; exec " + sh}
			})},
		{ID: "elementary-terminal", Name: "Elementary Terminal", Paths: []string{"io.elementary.terminal"},
			LaunchFn: shellExec("io.elementary.terminal", func(sh, cmd string) []string {
				return []string{"-e", sh + " -c '" + cmd + "; exec " + sh + "'"}
			})},
		{ID: "lxterminal", Name: "LXDE Terminal", Paths: []string{"lxterminal"},
			LaunchFn: shellExec("lxterminal", func(sh, cmd string) []string {
				return []string{"-e", sh + " -c '" + cmd + "; exec " + sh + "'"}
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

// OpenInTerminal opens a specific terminal (by ID) or auto-detects one and runs the command.
func (e *Executor) OpenInTerminal(terminalID string, cmdText string) error {
	defs := e.terminalDefs()

	if terminalID != "" {
		for _, d := range defs {
			if d.ID == terminalID && e.terminalExists(d) && d.LaunchFn != nil {
				return d.LaunchFn(e, cmdText)
			}
		}
		// Preferred terminal not found, fall through to auto-detect
	}

	// Auto-detect: use first available
	for _, d := range defs {
		if e.terminalExists(d) && d.LaunchFn != nil {
			return d.LaunchFn(e, cmdText)
		}
	}
	return fmt.Errorf("no terminal emulator found")
}

// EvalDefaults evaluates CEL expressions in variable definitions and returns resolved defaults.
// If evaluation fails, the raw Default string is returned as a literal fallback.
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
