package main

import (
	"bytes"
	"net/url"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// This file implements capture of "last command output" from OSC 133
// semantic-prompt markers emitted by the shell integration scripts installed
// by shell_integration.go. A shell with integration active wraps every
// command with:
//
//	ESC ] 133 ; C ; <nonce> BEL                     -- emitted just before the command's output begins
//	ESC ] 133 ; D ; <nonce> ; <exit-code> BEL       -- emitted once the command has finished
//
// captureScan watches the raw PTY byte stream for these markers and records
// the bytes between the most recent C and D as sessionState.lastOutput, so
// GetLastOutput can return the exact output of the last completed command —
// no reflow, no echoed command text, no prompt-regex guessing. Sessions
// running a shell without integration never see these markers, so
// lastValid stays false forever and the frontend falls back to scraping the
// xterm buffer (Terminal.tsx's getLastOutput).
//
// The same scripts also emit the standard OSC 7 working-directory report
// right after every D marker (and once at startup):
//
//	ESC ] 7 ; file://<host><percent-encoded absolute cwd> BEL
//
// captureScan decodes it into sessionState.cwd — the live directory
// SessionInfo.Cwd reports and shell_completion.go's path completion lists —
// and, like the 133 markers, keeps its bytes out of the captured output.
// OSC 7 deliberately carries NO nonce: it is a standard sequence other
// terminals and shells already exchange, and the only thing it steers is
// which directory Tab completion reads, so a forged one is harmless.
//
// <nonce> is a random per-session token (sessionState.oscNonce, set from
// generateOSCNonce in shell_integration.go) that a forked child process of
// the shell never sees (see stripNonce) — without it, a plain command could
// print these exact bytes as part of its own stdout/stderr and trick the
// scanner into treating that as a real boundary. It does NOT stop code that
// runs in-process in the same shell (a sourced profile/plugin, a shell
// function) from reading it too, same as our own hooks do — see the nonce
// comment in each shell-integration script for why that's an inherent,
// accepted limit rather than a gap this file can close.
const (
	// oscCapturePrefix is the fixed portion of the markers this scanner
	// looks for, shared by both the "C" (output start) and "D" (command
	// done) forms.
	oscCapturePrefix = "\x1b]133;"

	// oscCwdPrefix is the fixed portion of the OSC 7 working-directory
	// report; what follows it (up to the terminator) is a file:// URL.
	oscCwdPrefix = "\x1b]7;"

	// oscFileScheme is the URL scheme an OSC 7 payload must start with.
	oscFileScheme = "file://"

	// maxCaptureBytes bounds the in-flight captured output for a single
	// command. On overflow, the tail is kept and capTruncated is set —
	// preferring the most recent output over the earliest, since that's
	// what a user copying "the last output" almost always wants.
	maxCaptureBytes = 1 << 20

	// maxMarkerCarryBytes bounds how long captureScan will keep buffering
	// bytes while waiting for a marker's terminator (BEL or ST) before
	// giving up and treating the pending bytes as ordinary content. This
	// guards against unbounded memory growth if a marker is ever malformed
	// or truncated (e.g. a shell integration bug) and its terminator never
	// arrives.
	maxMarkerCarryBytes = 4096
)

// oscCapturePrefixBytes and oscCwdPrefixBytes are oscCapturePrefix and
// oscCwdPrefix pre-converted to []byte once, so captureScan's per-ESC-byte
// prefix checks (run on every ANSI escape in the stream, not just our
// markers) don't reallocate them on every call.
var (
	oscCapturePrefixBytes = []byte(oscCapturePrefix)
	oscCwdPrefixBytes     = []byte(oscCwdPrefix)
)

// captureScan feeds newly read PTY bytes through the OSC 133 / OSC 7 marker
// scanner. It must be called from the session's single readLoop goroutine
// only (it is not safe to call concurrently with itself), but it takes capMu
// because GetLastOutput and liveCwd read the resulting fields from other
// goroutines.
//
// It returns the session's working directory as of the end of data and
// whether that value changed during this call, so the caller can publish
// the change (see scanOutput in terminal_service.go) without holding capMu.
//
// data is treated as read-only and immutable after this call — callers
// (readLoop) must not reuse or mutate the backing array afterward, since
// captureScan may retain a copy of a trailing partial marker in capCarry
// until the next call resolves it.
func (ss *sessionState) captureScan(data []byte) (string, bool) {
	ss.capMu.Lock()
	defer ss.capMu.Unlock()

	before := ss.cwd
	ss.scanLocked(data)
	return ss.cwd, ss.cwd != before
}

// scanLocked is captureScan's body; capMu must be held.
func (ss *sessionState) scanLocked(data []byte) {
	buf := data
	if len(ss.capCarry) > 0 {
		buf = make([]byte, 0, len(ss.capCarry)+len(data))
		buf = append(buf, ss.capCarry...)
		buf = append(buf, data...)
		ss.capCarry = nil
	}

	i := 0
	for i < len(buf) {
		escIdx := bytes.IndexByte(buf[i:], escByte)
		if escIdx == -1 {
			ss.appendCapture(buf[i:])
			return
		}
		escIdx += i

		if escIdx > i {
			ss.appendCapture(buf[i:escIdx])
		}

		remaining := buf[escIdx:]

		// passOneByte treats the ESC at remaining[0] as ordinary content
		// (not our marker, or not confirmed as one yet) and resumes the
		// IndexByte search one byte later, where a real terminator or the
		// next genuine marker can still be found.
		passOneByte := func() {
			ss.appendCapture(remaining[:1])
			i = escIdx + 1
		}

		// OSC 7 first: its prefix is shorter than OSC 133's, so it must be
		// recognized before the "too short to tell yet" check below or a
		// chunk ending in e.g. "\x1b]7;f" would be passed through as content.
		if bytes.HasPrefix(remaining, oscCwdPrefixBytes) {
			paramsIdx := escIdx + len(oscCwdPrefix)
			termIdx, termLen, found := findOSCTerminator(buf, paramsIdx)
			if !found {
				if len(remaining) > maxMarkerCarryBytes {
					passOneByte()
					continue
				}
				ss.capCarry = append([]byte(nil), remaining...)
				return
			}
			if cwd, ok := parseOSC7(buf[paramsIdx:termIdx]); ok {
				ss.cwd = cwd
			}
			// Consumed either way: a malformed report is still an OSC 7 the
			// terminal would swallow, never visible command output.
			i = termIdx + termLen
			continue
		}

		if len(remaining) < len(oscCapturePrefix) {
			// Not enough bytes yet to know whether this is one of our
			// markers. Only worth carrying if what we have so far could
			// still become one.
			if bytes.HasPrefix(oscCapturePrefixBytes, remaining) || bytes.HasPrefix(oscCwdPrefixBytes, remaining) {
				ss.capCarry = append([]byte(nil), remaining...)
				return
			}
			passOneByte()
			continue
		}

		if !bytes.HasPrefix(remaining, oscCapturePrefixBytes) {
			// Some other escape sequence (CSI, a different OSC, etc).
			passOneByte()
			continue
		}

		kindIdx := escIdx + len(oscCapturePrefix)
		if kindIdx >= len(buf) {
			ss.capCarry = append([]byte(nil), remaining...)
			return
		}

		kind := buf[kindIdx]
		if kind != 'C' && kind != 'D' {
			// A different OSC 133 subtype (e.g. "A"/"B"/"P") we don't track.
			passOneByte()
			continue
		}

		termIdx, termLen, found := findOSCTerminator(buf, kindIdx+1)
		if !found {
			if len(remaining) > maxMarkerCarryBytes {
				// Never terminated within a generous bound — give up and
				// treat it as ordinary content rather than buffering
				// forever.
				passOneByte()
				continue
			}
			ss.capCarry = append([]byte(nil), remaining...)
			return
		}

		params, nonceOK := stripNonce(buf[kindIdx+1:termIdx], ss.oscNonce)
		if !nonceOK {
			// The nonce doesn't match this session's (or this session has
			// none), so this can't be a marker genuinely emitted by the
			// shell's own preexec/precmd hooks — it's a command printing
			// the same OSC 133 bytes in its own output, whether by
			// coincidence or deliberately, to fool GetLastOutput into
			// resetting or closing the capture early (see stripNonce).
			// Keep the bytes as literal captured content instead of acting
			// on them as a boundary.
			ss.appendCapture(buf[escIdx : termIdx+termLen])
			i = termIdx + termLen
			continue
		}

		switch kind {
		case 'C':
			ss.capBuf.Reset()
			ss.capTruncated = false
			ss.capturing = true
			ss.capCaptureCols = int(ss.capCols.Load())
		case 'D':
			if ss.capturing {
				ss.lastOutput = stripANSI(ss.capBuf.String(), ss.capCaptureCols)
				ss.lastExitCode = parseExitCode(params)
				ss.lastTruncated = ss.capTruncated
				ss.lastValid = true
				ss.capturing = false
			}
			// A "D" with no preceding "C" happens on the shell's very first
			// precmd (fired before any command has run) — nothing to close.
		}

		i = termIdx + termLen
	}
}

// stripNonce verifies that params (the raw bytes between an OSC 133
// marker's kind byte and its terminator, e.g. ";a1b2;0") begin with
// ";<nonce>", returning whatever follows — e.g. ";0" for a "D" marker's exit
// code, or empty for "C". nonce is this session's expected value (see
// oscNonceFileEnvVar in shell_integration.go); a session with no nonce
// (shell integration inactive) never matches, so no marker from an
// uninstrumented shell is ever trusted.
//
// This authentication is what makes it safe for captureScan to trust a "C"/
// "D" marker at all: without it, a command could print the literal bytes
// "\x1b]133;D;0\a" as part of its own output and trick the scanner into
// treating that as the shell's real end-of-command boundary.
func stripNonce(params []byte, nonce string) ([]byte, bool) {
	if nonce == "" {
		return nil, false
	}
	prefix := append([]byte{';'}, nonce...)
	if !bytes.HasPrefix(params, prefix) {
		return nil, false
	}
	return params[len(prefix):], true
}

// parseOSC7 decodes the payload of an OSC 7 report (the bytes between
// "\x1b]7;" and the terminator) into a local absolute path. Accepted forms
// are "file:///path", "file://localhost/path" and "file://<hostname>/path"
// — the host is ignored, since the shell runs on this machine by
// definition — plus the Windows drive form "file:///C:/Users/me", whose
// leading slash is dropped. Percent-escapes are decoded (a payload with a
// stray, unencoded "%" is kept verbatim rather than rejected). Anything
// else — no file:// scheme, no path, a relative path — returns ok=false so
// the previous value is kept.
func parseOSC7(params []byte) (string, bool) {
	rest, ok := strings.CutPrefix(string(params), oscFileScheme)
	if !ok {
		return "", false
	}
	slash := strings.IndexByte(rest, '/')
	if slash < 0 {
		return "", false
	}
	p := rest[slash:]
	if decoded, err := url.PathUnescape(p); err == nil {
		p = decoded
	}
	if isDrivePath(p) {
		// "/C:/..." -> "C:/...". Cleaned with path (not filepath) so this is
		// deterministic on every OS, then converted to the host's separator.
		p = path.Clean(p[1:])
		if len(p) == windowsDriveRootLen {
			// path.Clean("C:/") is "C:", which on Windows means "the current
			// directory on C", not the drive's root — put the slash back.
			p += "/"
		}
		if runtime.GOOS == "windows" {
			p = filepath.FromSlash(p)
		}
		return p, true
	}
	if !strings.HasPrefix(p, "/") {
		return "", false
	}
	return path.Clean(p), true
}

const (
	// driveSpecLen is the length of the "/C:" run that opens a Windows
	// drive path inside a file:// URL.
	driveSpecLen = 3
	// windowsDriveRootLen is the length of a bare drive spec ("C:") once
	// that leading slash is gone.
	windowsDriveRootLen = 2
)

// isDrivePath reports whether p is a file:// path of the Windows form
// "/C:" or "/C:/...".
func isDrivePath(p string) bool {
	if len(p) < driveSpecLen || p[0] != '/' || p[2] != ':' {
		return false
	}
	if len(p) > driveSpecLen && p[driveSpecLen] != '/' {
		return false
	}
	c := p[1]
	return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
}

// liveCwd returns the working directory the shell last reported via OSC 7,
// or "" if it hasn't reported one since the session (re)started. Callers
// fall back to sessionState.workingDir in that case. Safe to call from any
// goroutine, including while holding ss.mu (mu -> capMu is the established
// lock order; see Clear).
func (ss *sessionState) liveCwd() string {
	ss.capMu.Lock()
	defer ss.capMu.Unlock()
	return ss.cwd
}

// resetCwd forgets the last OSC 7 report. Called on the restart path only
// (a fresh shell starts back in workingDir and will report itself) — NOT
// from Clear/resetCapture, since clearing the screen doesn't move the
// shell, and zsh/bash don't run their prompt hooks on Ctrl+L, so the value
// would otherwise stay stale until the next command finished. Same
// ordering rule as resetCapture: only call it once the previous readLoop
// goroutine has exited.
func (ss *sessionState) resetCwd() {
	ss.capMu.Lock()
	defer ss.capMu.Unlock()
	ss.cwd = ""
}

// appendCapture writes b to capBuf when a command's output is actively being
// captured, enforcing maxCaptureBytes by keeping the tail on overflow. It is
// a no-op outside an active C..D span so unrelated shell chatter (prompts,
// key echo) is never recorded.
func (ss *sessionState) appendCapture(b []byte) {
	if !ss.capturing || len(b) == 0 {
		return
	}
	ss.capBuf.Write(b)
	if excess := ss.capBuf.Len() - maxCaptureBytes; excess > 0 {
		// Next(excess) just advances the buffer's read offset — O(1), no
		// copy — rather than re-copying the whole maxCaptureBytes tail on
		// every write once a command's output exceeds the cap.
		ss.capBuf.Next(excess)
		ss.capTruncated = true
	}
}

// findOSCTerminator looks for an OSC terminator (BEL or the two-byte ST,
// ESC '\') starting at buf[start:], returning its index and byte length.
// found is false when neither appears before the end of buf, meaning the
// caller must wait for more data.
func findOSCTerminator(buf []byte, start int) (int, int, bool) {
	for i := start; i < len(buf); i++ {
		switch {
		case buf[i] == belByte:
			return i, 1, true
		case buf[i] == escByte && i+1 < len(buf) && buf[i+1] == '\\':
			return i, escSeqIntroLen, true
		}
	}
	return 0, 0, false
}

// parseExitCode extracts the integer exit code from a "D" marker's params,
// e.g. ";0" or ";127". It defaults to 0 for the params-less/malformed case
// rather than erroring — an unparsable exit code shouldn't block returning
// the (correctly captured) output text.
func parseExitCode(params []byte) int {
	p := bytes.TrimPrefix(params, []byte(";"))
	if len(p) == 0 {
		return 0
	}
	n, err := strconv.Atoi(string(p))
	if err != nil {
		return 0
	}
	return n
}

// resetCapture clears all capture state. Called when a session (re)starts
// its shell or its screen is cleared — in both cases any in-flight or last
// captured output refers to a command the user can no longer see or that no
// longer applies.
//
// On the restart path, callers MUST NOT call this until the previous
// session's readLoop goroutine has actually exited (e.g. after
// releaseOldProcess's readerWg.Wait()) — otherwise a straggling captureScan
// call from that dying goroutine's final read can repopulate the state this
// just cleared.
func (ss *sessionState) resetCapture() {
	ss.capMu.Lock()
	defer ss.capMu.Unlock()

	ss.capBuf.Reset()
	ss.capCarry = nil
	ss.capturing = false
	ss.capTruncated = false
	ss.lastOutput = ""
	ss.lastExitCode = 0
	ss.lastTruncated = false
	ss.lastValid = false
}

// TerminalLastOutput is the result of TerminalService.GetLastOutput.
type TerminalLastOutput struct {
	// Available is false when no command has completed under shell
	// integration yet (including sessions whose shell has no integration at
	// all) — Text/ExitCode/Truncated are zero values in that case, and the
	// frontend should fall back to scraping the xterm buffer.
	Available bool   `json:"available"`
	Text      string `json:"text"`
	ExitCode  int    `json:"exitCode"`
	Truncated bool   `json:"truncated"`
}

// GetLastOutput returns the captured output of the most recently completed
// command in the given session, as recorded via OSC 133 shell-integration
// markers.
func (s *TerminalService) GetLastOutput(sessionId string) (TerminalLastOutput, error) {
	ss, err := s.resolveSession(sessionId)
	if err != nil {
		return TerminalLastOutput{}, err
	}

	ss.capMu.Lock()
	defer ss.capMu.Unlock()

	if !ss.lastValid {
		return TerminalLastOutput{}, nil
	}

	return TerminalLastOutput{
		Available: true,
		Text:      ss.lastOutput,
		ExitCode:  ss.lastExitCode,
		Truncated: ss.lastTruncated,
	}, nil
}
