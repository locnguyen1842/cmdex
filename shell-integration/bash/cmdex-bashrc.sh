# Cmdex shell integration — bash
#
# Passed via `--rcfile <this file> -i`, replacing bash's normal login-shell
# startup (`-l`, which bash ignores whenever --rcfile is also given — the two
# flags are mutually exclusive in bash's startup-file selection logic) so we
# can also install OSC 133 hooks. To preserve the user's usual login-shell
# environment, this manually replicates bash's own login sequence: /etc/profile,
# then the first of ~/.bash_profile, ~/.bash_login, ~/.profile that exists —
# deliberately NOT ~/.bashrc directly, matching real login bash (their own
# .bash_profile is free to source .bashrc itself, same as on a real login
# terminal).

# Capture the per-session OSC nonce (see generateOSCNonce/writeNonceFile in
# shell_integration.go and stripNonce in terminal_capture.go) into a
# non-exported shell variable, then delete the file and scrub its path from
# the environment before anything below runs. The nonce is passed as a file
# rather than directly as an env var value on purpose: a shell `unset`ting an
# exported variable only edits its own live view of the environment — on
# Linux it does NOT erase the original environment block the kernel copied
# into this process's memory at exec() time, and /proc/<pid>/environ keeps
# exposing that block verbatim (to any same-uid process) for as long as this
# shell runs, regardless of any unset done here. A plain command run below —
# `cat /proc/$PPID/environ` — could otherwise recover the nonce that way and
# forge a "C"/"D" marker in its own output. Deleting the file (rather than
# just an env var) before anything else runs means no forked child ever gets
# a chance to read it, by either route.
#
# It does NOT protect against code that runs IN this shell process rather
# than as a child of it — a sourced profile/plugin, a shell function, `eval`
# — since bash has no privacy between different code sharing one process:
# anything running in-process can read (or overwrite) any variable here by
# name, exported or not, the same way our own hooks below do. There's no
# fix for that at this layer (every OSC-133-based terminal integration has
# the same property), and it isn't a materially bigger hole regardless: code
# that already runs in-process in the user's shell can do far worse than
# spoof a copy-output marker — read their history, exfiltrate secrets, run
# anything as them.
if [ -n "$CMDEX_OSC_NONCE_FILE" ] && [ -r "$CMDEX_OSC_NONCE_FILE" ]; then
    __cmdex_nonce="$(cat "$CMDEX_OSC_NONCE_FILE")"
    rm -f "$CMDEX_OSC_NONCE_FILE"
fi
unset CMDEX_OSC_NONCE_FILE

if [ -r /etc/profile ]; then
    source /etc/profile
fi

if [ -r "$HOME/.bash_profile" ]; then
    source "$HOME/.bash_profile"
elif [ -r "$HOME/.bash_login" ]; then
    source "$HOME/.bash_login"
elif [ -r "$HOME/.profile" ]; then
    source "$HOME/.profile"
fi

# --- OSC 133 hooks ---
#
# bash has no preexec/precmd hook mechanism of its own, so this adapts the
# well-known bash-preexec.sh pattern: the DEBUG trap fires before every
# simple command (including each stage of a pipeline and each statement in a
# compound command), so __cmdex_armed gates it to fire exactly once per
# top-level command rather than once per simple command. It starts at 0 (not
# armed) so nothing fires while this file itself — or the user's own sourced
# profile above — is still running; it only becomes armed once
# __cmdex_emit_marker has run for the first time, i.e. right before the
# first real prompt is shown to the user.
#
# The work done once a command finishes is deliberately split into two
# PROMPT_COMMAND entries rather than one:
#
#   - __cmdex_capture_exit is PREPENDED, so it runs BEFORE whatever the
#     user's own profile may have put in PROMPT_COMMAND (git-prompt.sh,
#     starship, a timing plugin, ...). Those commonly run commands of their
#     own, which overwrite $? — capturing it first, before any of that runs,
#     is the only way the reported exit code reliably reflects the command
#     the user actually typed rather than the last thing the user's own
#     prompt machinery happened to run.
#   - __cmdex_emit_marker is APPENDED LAST (after whatever the user's own
#     profile may have set), so armed only flips back to 1 once bash is done
#     running everything queued for after a command finishes — the very next
#     DEBUG trap firing after that is genuinely the user's next typed
#     command, not more of our/their own prompt machinery.
#
# Known limitation: bash allows only one DEBUG trap handler at a time. If the
# user's own profile also relies on one (e.g. a command-timing tool), it is
# overwritten here rather than chained — the same limitation bash-preexec.sh
# itself documents.
__cmdex_armed=0

__cmdex_debug_trap() {
    if [ "$__cmdex_armed" = "1" ]; then
        __cmdex_armed=0
        printf '\e]133;C;%s\a' "$__cmdex_nonce"
    fi
}

__cmdex_capture_exit() {
    __cmdex_ec=$?
}

# __cmdex_urlencode percent-encodes its argument for the path part of a
# file:// URL: everything except unreserved ASCII and "/" is written as %XX
# per UTF-8 byte, using the same "copy the safe run, encode one byte,
# repeat" loop as vte.sh. It runs in a subshell so LC_ALL=C — which makes
# ${str#?} strip a single byte (not a character) and "'$str" yield that
# byte's value — never leaks into the user's session. The "& 255" mask is
# for bash 3.2 (macOS's /bin/bash), whose printf reports bytes >= 0x80 as
# negative numbers.
__cmdex_urlencode() (
    LC_ALL=C
    local str="$1" safe c
    while [ -n "$str" ]; do
        safe="${str%%[!A-Za-z0-9/._~-]*}"
        printf '%s' "$safe"
        str="${str#"$safe"}"
        if [ -n "$str" ]; then
            c=$(printf '%d' "'$str")
            printf '%%%02X' "$(( c & 255 ))"
            str="${str#?}"
        fi
    done
)

# __cmdex_report_cwd emits the standard OSC 7 "current working directory"
# sequence (ESC ] 7 ; file://<host><percent-encoded $PWD> BEL) that
# terminal_capture.go decodes into SessionInfo.Cwd, so the app's own path
# completion (shell_completion.go) can list the directory the shell is
# actually in rather than the one it was started in. Unlike the OSC 133
# markers this carries no nonce: it's a standard, widely emitted sequence
# (macOS Terminal, VTE, kitty, fish all speak it), and the worst a forged one
# can do is point Tab completion at the wrong directory.
__cmdex_report_cwd() {
    printf '\e]7;file://%s%s\a' "$HOSTNAME" "$(__cmdex_urlencode "$PWD")"
}

# The cwd report comes AFTER the D marker so it never lands inside a C..D
# capture span, and runs on every prompt (not only when $PWD changes) so a
# cd inside a sourced script is still picked up.
__cmdex_emit_marker() {
    printf '\e]133;D;%s;%s\a' "$__cmdex_nonce" "$__cmdex_ec"
    __cmdex_report_cwd
    __cmdex_armed=1
}

trap '__cmdex_debug_trap' DEBUG

# Report the starting directory right away so completion has a value before
# the first prompt (PROMPT_COMMAND reports it again then). bash only reads
# --rcfile for an interactive shell, so this is always interactive in
# practice; the guard just keeps a manual `source` of this file from writing
# escape sequences into a non-terminal stdout.
if [[ $- == *i* ]]; then
    __cmdex_report_cwd
fi

# bash only started running PROMPT_COMMAND as an array (each element run in
# order) in 5.1; before that it was always a single string bash evaluated
# as-is. If we always built the new value as a string here, a profile that
# had set PROMPT_COMMAND as an array (some prompt/timing tools do) would
# have every element past the first silently discarded by this scalar
# expansion — "${PROMPT_COMMAND[@]}" avoids that: bash expands it to every
# element when PROMPT_COMMAND is an array, or the one value when it's a
# plain scalar, or nothing when it's unset, so building the replacement as
# an array preserves whichever shape it already had. This is only safe to
# do on 5.1+ though — on older bash, assigning an array here would mean only
# its first element (this bash still has no concept of "run every element")
# ever runs, silently dropping __cmdex_emit_marker (and the OSC "D" marker
# with it) every single time.
if ((BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1))); then
    PROMPT_COMMAND=(__cmdex_capture_exit "${PROMPT_COMMAND[@]}" __cmdex_emit_marker)
else
    PROMPT_COMMAND="__cmdex_capture_exit${PROMPT_COMMAND:+$'\n'$PROMPT_COMMAND}"$'\n'"__cmdex_emit_marker"
fi
