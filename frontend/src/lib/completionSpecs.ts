/**
 * A small, static Fig-like completion spec table for the terminal's Warp-style
 * tab completion (utils/terminalCompletion.ts resolves a typed prompt line
 * against this table; Terminal.tsx renders the results). Data only — no I/O,
 * no React, nothing async.
 *
 * Each command may declare:
 *  - `args`: what its own positional arguments are (a path, a directory-only
 *    path, nothing worth completing, or another command name), used when the
 *    typed token isn't a recognized subcommand and doesn't start with "-".
 *  - `options`: flags available at that level, matched by prefix.
 *  - `subcommands`: the command's own verbs (git's `checkout`, docker's
 *    `run`, …), each of which can carry its own `args`/`options` that
 *    override the parent's for that position.
 *
 * A single canonical name is used per option (its short form where one is
 * idiomatic, otherwise the long form) rather than every alias, to keep
 * prefix-matching simple — typing the other alias of a dual-form flag won't
 * surface it. Only two levels of nesting are modeled (command -> subcommand);
 * tools with a third level (`docker compose up`, `gh pr list`, `git stash
 * push`) expose their second-level verb with a description that mentions the
 * deeper verbs in prose, rather than completing them individually.
 */

export type ArgsKind = 'path' | 'dir' | 'none' | 'command';

export interface OptionSpec {
  /** Canonical flag spelling, e.g. "-b" or "--force". */
  name: string;
  description?: string;
  /** What this option's own value is, when it takes one (e.g. `-f <file>`). */
  args?: ArgsKind;
}

export interface SubcommandSpec {
  name: string;
  description?: string;
  args?: ArgsKind;
  options?: OptionSpec[];
}

export interface CommandSpec {
  description?: string;
  args?: ArgsKind;
  options?: OptionSpec[];
  subcommands?: SubcommandSpec[];
}

export type CompletionSpecs = Record<string, CommandSpec>;

function o(name: string, description: string, args?: ArgsKind): OptionSpec {
  return args ? { name, description, args } : { name, description };
}

function s(name: string, description: string, args?: ArgsKind, options?: OptionSpec[]): SubcommandSpec {
  const spec: SubcommandSpec = { name, description };
  if (args) spec.args = args;
  if (options) spec.options = options;
  return spec;
}

// ── git ──────────────────────────────────────────────────────────────────
const gitOptions = {
  add: [
    o('-A', 'Stage all changes'),
    o('-p', 'Interactively stage hunks'),
    o('-u', 'Stage modified and deleted only'),
    o('-n', 'Show what would be staged'),
    o('-f', 'Allow adding ignored files'),
  ],
  commit: [
    o('-m', 'Commit message'),
    o('-a', 'Stage all tracked changes'),
    o('--amend', 'Amend the previous commit'),
    o('-n', 'Skip commit hooks'),
    o('-v', 'Show diff in commit message'),
    o('-s', 'Add a Signed-off-by line'),
  ],
  push: [
    o('-f', 'Force push (may lose commits)'),
    o('-u', 'Set the upstream branch'),
    o('--tags', 'Push tags'),
    o('-n', 'Show what would be pushed'),
    o('--force-with-lease', 'Safer force push'),
  ],
  pull: [
    o('--rebase', 'Rebase instead of merge'),
    o('--no-rebase', 'Merge instead of rebase'),
    o('--ff-only', 'Only fast-forward'),
    o('-p', 'Prune remote-tracking refs'),
  ],
  checkout: [
    o('-b', 'Create and switch to a new branch'),
    o('-B', 'Create or reset and switch'),
    o('--force', 'Discard local changes'),
    o('--track', 'Set up tracking for the new branch'),
    o('--quiet', 'Suppress feedback messages'),
  ],
  switch: [
    o('-c', 'Create and switch to a new branch'),
    o('-C', 'Create or reset and switch'),
    o('--detach', 'Detach HEAD at the target'),
    o('--track', 'Set up tracking for the new branch'),
  ],
  branch: [
    o('-d', 'Delete a branch'),
    o('-D', 'Force delete a branch'),
    o('-m', 'Rename a branch'),
    o('-a', 'List local and remote branches'),
    o('-r', 'List remote branches'),
    o('-v', 'Show SHA and subject'),
  ],
  rebase: [
    o('-i', 'Interactive rebase'),
    o('--onto', 'Rebase onto a branch'),
    o('--continue', 'Continue after resolving conflicts'),
    o('--abort', 'Abort the rebase'),
    o('--skip', 'Skip the current commit'),
  ],
  merge: [
    o('--no-ff', 'Always create a merge commit'),
    o('--squash', 'Squash commits into one'),
    o('--abort', 'Abort the merge'),
    o('-m', 'Merge commit message'),
  ],
  log: [
    o('--oneline', 'One line per commit'),
    o('--graph', 'Show an ASCII commit graph'),
    o('--all', 'Show all refs'),
    o('-p', 'Show diffs'),
    o('-n', 'Limit the number of commits'),
    o('--stat', 'Show changed-file stats'),
  ],
  status: [
    o('-s', 'Short format'),
    o('-b', 'Show branch info'),
    o('--ignored', 'Show ignored files'),
  ],
  stash: [
    o('-u', 'Include untracked files'),
    o('-p', 'Interactively stash hunks'),
    o('--keep-index', 'Keep changes staged'),
  ],
  reset: [
    o('--hard', 'Discard working changes'),
    o('--soft', 'Keep changes staged'),
    o('--mixed', 'Unstage but keep changes'),
  ],
  diff: [
    o('--stat', 'Show a diffstat summary'),
    o('--cached', 'Diff staged changes'),
    o('-w', 'Ignore whitespace changes'),
  ],
  restore: [
    o('--staged', 'Restore the index'),
    o('--source', 'Restore from a commit'),
    o('-W', 'Restore the working tree'),
  ],
  clone: [
    o('--depth', 'Shallow clone depth'),
    o('-b', 'Clone a specific branch'),
    o('--recursive', 'Clone submodules too'),
  ],
  fetch: [
    o('--all', 'Fetch every remote'),
    o('-p', 'Remove stale remote branches'),
    o('--tags', 'Fetch all tags'),
  ],
  tag: [
    o('-a', 'Create an annotated tag'),
    o('-d', 'Delete a tag'),
    o('-l', 'List tags'),
  ],
  remote: [o('-v', 'Show remote URLs')],
  cherryPick: [
    o('--continue', 'Continue after resolving conflicts'),
    o('--abort', 'Abort the cherry-pick'),
    o('-n', 'Apply without committing'),
  ],
  revert: [
    o('--no-commit', 'Revert without committing'),
    o('--continue', 'Continue after resolving conflicts'),
    o('--abort', 'Abort the revert'),
  ],
  worktree: [
    o('-f', 'Force the operation'),
    o('--detach', 'Detach HEAD in the new worktree'),
  ],
};

const git: CommandSpec = {
  description: 'Distributed version control',
  subcommands: [
    s('init', 'Create an empty repository'),
    s('clone', 'Clone a repository', 'path', gitOptions.clone),
    s('add', 'Stage changes', 'path', gitOptions.add),
    s('mv', 'Move or rename a file', 'path'),
    s('restore', 'Restore working tree files', 'path', gitOptions.restore),
    s('rm', 'Remove files from the index', 'path'),
    s('commit', 'Record staged changes', undefined, gitOptions.commit),
    s('status', 'Show working tree status', undefined, gitOptions.status),
    s('diff', 'Show changes between commits', 'path', gitOptions.diff),
    s('log', 'Show commit history', undefined, gitOptions.log),
    s('show', 'Show an object'),
    s('blame', 'Show who changed each line', 'path'),
    s('bisect', 'Binary search for a bad commit'),
    s('tag', 'Create, list, or delete tags', undefined, gitOptions.tag),
    s('branch', 'List, create, or delete branches', undefined, gitOptions.branch),
    s('checkout', 'Switch branches or restore files', 'path', gitOptions.checkout),
    s('switch', 'Switch branches', undefined, gitOptions.switch),
    s('merge', 'Merge branches', undefined, gitOptions.merge),
    s('rebase', 'Reapply commits on another base', undefined, gitOptions.rebase),
    s('reset', 'Reset current HEAD to a state', undefined, gitOptions.reset),
    s('cherry-pick', 'Apply commits from another branch', undefined, gitOptions.cherryPick),
    s('revert', 'Revert existing commits', undefined, gitOptions.revert),
    s('stash', 'Stash uncommitted changes', undefined, gitOptions.stash),
    s('worktree', 'Manage multiple working trees', undefined, gitOptions.worktree),
    s('fetch', 'Download objects from a remote', undefined, gitOptions.fetch),
    s('pull', 'Fetch and integrate a remote', undefined, gitOptions.pull),
    s('push', 'Update remote refs', undefined, gitOptions.push),
    s('remote', 'Manage remote repositories', undefined, gitOptions.remote),
    s('submodule', 'Manage submodules'),
    s('config', 'Get or set config values'),
    s('describe', 'Describe a commit using tags'),
    s('clean', 'Remove untracked files', 'path'),
    s('gc', 'Cleanup unnecessary files'),
    s('grep', 'Search tracked files for a pattern', 'path'),
    s('reflog', 'Show history of ref updates'),
    s('shortlog', 'Summarize log by author'),
    s('archive', 'Create an archive of files'),
    s('apply', 'Apply a patch', 'path'),
    s('am', 'Apply patches from a mailbox', 'path'),
    s('rev-parse', 'Parse revision or path arguments'),
  ],
};

// ── docker ───────────────────────────────────────────────────────────────
const docker: CommandSpec = {
  description: 'Build and run containers',
  subcommands: [
    s('run', 'Run a new container', 'none', [
      o('-d', 'Run in the background'),
      o('-it', 'Interactive session with a TTY'),
      o('-p', 'Publish a port'),
      o('-v', 'Mount a volume'),
      o('--rm', 'Remove the container on exit'),
      o('-e', 'Set an environment variable'),
      o('--name', 'Name the container'),
    ]),
    s('ps', 'List containers', 'none', [o('-a', 'Show all containers'), o('-q', 'Only print IDs')]),
    s('images', 'List images', 'none', [o('-a', 'Show all images'), o('-q', 'Only print IDs')]),
    s('build', 'Build an image from a Dockerfile', 'path', [
      o('-t', 'Name and tag the image'),
      o('-f', 'Dockerfile to use', 'path'),
      o('--no-cache', 'Disable the build cache'),
    ]),
    s('pull', 'Pull an image from a registry'),
    s('push', 'Push an image to a registry'),
    s('exec', 'Run a command in a container', 'none', [o('-it', 'Interactive session with a TTY')]),
    s('logs', 'Fetch container logs', 'none', [
      o('-f', 'Follow log output'),
      o('--tail', 'Show only the last N lines'),
    ]),
    s('stop', 'Stop a running container'),
    s('start', 'Start a stopped container'),
    s('rm', 'Remove containers'),
    s('rmi', 'Remove images'),
    s('compose', 'Docker Compose (up, down, logs, ps, build, exec, restart, pull)'),
  ],
};

// ── npm / pnpm / yarn / bun ──────────────────────────────────────────────
function packageManager(description: string): CommandSpec {
  const options = [
    o('-D', 'Add as a dev dependency'),
    o('-g', 'Act globally'),
    o('--save-exact', 'Pin the exact version'),
  ];
  return {
    description,
    subcommands: [
      s('install', 'Install dependencies', 'none', options),
      s('add', 'Add a dependency', 'none', options),
      s('remove', 'Remove a dependency'),
      s('run', 'Run a package script'),
      s('test', 'Run tests'),
      s('build', 'Run the build script'),
      s('dev', 'Run the dev script'),
      s('start', 'Run the start script'),
      s('init', 'Create a package.json'),
      s('update', 'Update dependencies'),
      s('outdated', 'Check for outdated dependencies'),
      s('publish', 'Publish the package'),
      s('exec', 'Execute a package binary'),
      s('dlx', 'Run a package without installing'),
      s('create', 'Scaffold a new project'),
    ],
  };
}

// ── go ───────────────────────────────────────────────────────────────────
const goOptions = [
  o('-o', 'Output file', 'path'),
  o('-v', 'Verbose output'),
  o('-race', 'Enable the race detector'),
  o('-tags', 'Build tags'),
];
const go: CommandSpec = {
  description: 'Go toolchain',
  subcommands: [
    s('build', 'Compile packages', 'path', goOptions),
    s('run', 'Compile and run a program', 'path', goOptions),
    s('test', 'Run tests', 'path', goOptions),
    s('mod', 'Module maintenance (tidy, download, vendor)'),
    s('get', 'Add or update a dependency'),
    s('fmt', 'Format source files', 'path'),
    s('vet', 'Report likely mistakes', 'path'),
    s('install', 'Compile and install'),
    s('generate', 'Run go:generate directives'),
    s('version', 'Print the Go version'),
    s('env', 'Print the Go environment'),
    s('clean', 'Remove object files'),
  ],
};

// ── kubectl ──────────────────────────────────────────────────────────────
const kubectl: CommandSpec = {
  description: 'Kubernetes cluster CLI',
  subcommands: [
    s('get', 'Display one or more resources', undefined, [
      o('-o', 'Output format'),
      o('-n', 'Target namespace'),
      o('-w', 'Watch for changes'),
      o('-A', 'All namespaces'),
    ]),
    s('describe', 'Show details of a resource', undefined, [o('-n', 'Target namespace')]),
    s('apply', 'Apply a configuration', undefined, [
      o('-f', 'Manifest file or directory', 'path'),
      o('-n', 'Target namespace'),
      o('--dry-run', 'Preview without applying'),
    ]),
    s('delete', 'Delete resources', undefined, [o('-f', 'Manifest file', 'path'), o('-n', 'Target namespace')]),
    s('logs', 'Print container logs', undefined, [
      o('-f', 'Follow log output'),
      o('-n', 'Target namespace'),
      o('-c', 'Target container'),
    ]),
    s('exec', 'Run a command in a container', undefined, [
      o('-it', 'Interactive session with a TTY'),
      o('-n', 'Target namespace'),
      o('-c', 'Target container'),
    ]),
    s('port-forward', 'Forward local ports to a pod'),
    s('config', 'Manage kubeconfig files'),
    s('rollout', 'Manage a resource rollout (status, restart, undo)'),
    s('scale', 'Scale a resource', undefined, [o('--replicas', 'Desired replica count')]),
  ],
};

// ── brew ─────────────────────────────────────────────────────────────────
const brew: CommandSpec = {
  description: 'Homebrew package manager',
  subcommands: [
    s('install', 'Install a formula or cask', 'none', [
      o('--cask', 'Install a cask'),
      o('-v', 'Verbose output'),
    ]),
    s('uninstall', 'Remove a formula or cask'),
    s('update', 'Update Homebrew itself'),
    s('upgrade', 'Upgrade installed packages'),
    s('search', 'Search available packages'),
    s('info', 'Show info about a package'),
    s('list', 'List installed packages', 'none', [o('--versions', 'Show installed versions')]),
    s('services', 'Manage background services'),
    s('tap', 'Add a third-party repository'),
    s('doctor', 'Check the install for problems'),
    s('cleanup', 'Remove old versions and caches'),
  ],
};

// ── gh ───────────────────────────────────────────────────────────────────
const gh: CommandSpec = {
  description: 'GitHub CLI',
  subcommands: [
    s('pr', 'Manage pull requests (list, create, view, checkout)'),
    s('issue', 'Manage issues (list, create, view)'),
    s('repo', 'Manage repositories (view, clone, create)'),
    s('run', 'Manage workflow runs (list, view, watch)'),
  ],
};

// ── aws ──────────────────────────────────────────────────────────────────
const aws: CommandSpec = {
  description: 'AWS CLI',
  subcommands: [
    s('s3', 'Manage S3 buckets and objects'),
    s('ec2', 'Manage EC2 instances'),
    s('lambda', 'Manage Lambda functions'),
    s('iam', 'Manage IAM users, roles, and policies'),
  ],
};

// ── terraform ────────────────────────────────────────────────────────────
const terraform: CommandSpec = {
  description: 'Infrastructure as code',
  subcommands: [
    s('init', 'Initialize a working directory'),
    s('plan', 'Show the execution plan'),
    s('apply', 'Apply the changes'),
    s('destroy', 'Destroy managed infrastructure'),
    s('fmt', 'Format configuration files', 'path'),
    s('validate', 'Validate the configuration'),
  ],
};

// ── systemctl ────────────────────────────────────────────────────────────
const systemctl: CommandSpec = {
  description: 'Control systemd services',
  args: 'none',
  subcommands: [
    s('start', 'Start a unit', 'none'),
    s('stop', 'Stop a unit', 'none'),
    s('restart', 'Restart a unit', 'none'),
    s('status', 'Show unit status', 'none'),
    s('enable', 'Enable a unit at boot', 'none'),
    s('disable', 'Disable a unit at boot', 'none'),
  ],
};

// ── pip / pip3 ───────────────────────────────────────────────────────────
function pip(): CommandSpec {
  return {
    description: 'Python package installer',
    subcommands: [
      s('install', 'Install packages', 'none', [
        o('-r', 'Install from a requirements file', 'path'),
        o('-U', 'Upgrade packages'),
        o('-e', 'Install in editable mode', 'path'),
      ]),
      s('uninstall', 'Uninstall packages'),
      s('list', 'List installed packages'),
      s('freeze', 'Output installed packages in requirements format'),
      s('show', 'Show info about a package'),
      s('download', 'Download packages without installing', 'path'),
    ],
  };
}

// ── cargo ────────────────────────────────────────────────────────────────
const cargo: CommandSpec = {
  description: 'Rust package manager',
  subcommands: [
    s('build', 'Compile the current package', 'none', [o('--release', 'Optimized build'), o('-v', 'Verbose output')]),
    s('run', 'Build and run the main binary', 'none', [o('--release', 'Optimized build')]),
    s('test', 'Run tests'),
    s('check', 'Check without producing a binary'),
    s('clippy', 'Run the Clippy linter'),
    s('fmt', 'Format source files'),
    s('add', 'Add a dependency'),
    s('remove', 'Remove a dependency'),
    s('update', 'Update dependencies'),
    s('publish', 'Publish to crates.io'),
    s('doc', 'Build documentation'),
    s('bench', 'Run benchmarks'),
    s('install', 'Install a Rust binary'),
    s('new', 'Create a new package', 'path'),
    s('init', 'Create a package in an existing directory'),
  ],
};

// ── curl / wget / ssh / scp ──────────────────────────────────────────────
const curl: CommandSpec = {
  description: 'Transfer data from a URL',
  args: 'none',
  options: [
    o('-X', 'HTTP method'),
    o('-H', 'Add a request header'),
    o('-d', 'Send a request body'),
    o('-o', 'Write output to a file', 'path'),
    o('-L', 'Follow redirects'),
    o('-s', 'Silent mode'),
    o('-i', 'Include response headers'),
    o('-u', 'user:password for authentication'),
  ],
};

const wget: CommandSpec = {
  description: 'Download files from the web',
  args: 'none',
  options: [
    o('-O', 'Write output to a file', 'path'),
    o('-r', 'Recursive download'),
    o('-q', 'Quiet mode'),
    o('-c', 'Resume a partial download'),
  ],
};

const ssh: CommandSpec = {
  description: 'Secure shell client',
  args: 'none',
  options: [
    o('-p', 'Port to connect to'),
    o('-i', 'Identity (private key) file', 'path'),
    o('-L', 'Forward a local port'),
    o('-v', 'Verbose output'),
  ],
};

const scp: CommandSpec = {
  description: 'Secure copy over SSH',
  args: 'path',
  options: [
    o('-r', 'Copy directories recursively'),
    o('-P', 'Port to connect to'),
    o('-i', 'Identity (private key) file', 'path'),
  ],
};

// ── search / text tools ──────────────────────────────────────────────────
function grepLike(description: string): CommandSpec {
  return {
    description,
    args: 'path',
    options: [
      o('-i', 'Ignore case'),
      o('-r', 'Recurse into directories'),
      o('-n', 'Show line numbers'),
      o('-l', 'Only list matching file names'),
      o('-v', 'Invert the match'),
      o('-E', 'Extended regular expressions'),
      o('-w', 'Match whole words only'),
    ],
  };
}

const find: CommandSpec = {
  description: 'Search for files in a directory tree',
  args: 'path',
  options: [
    o('-name', 'Match by file name'),
    o('-type', 'Match by entry type'),
    o('-mtime', 'Modified N days ago'),
  ],
};

const sed: CommandSpec = {
  description: 'Stream editor for filtering text',
  args: 'path',
  options: [
    o('-i', 'Edit files in place'),
    o('-e', 'Add an editing script'),
    o('-n', 'Suppress automatic printing'),
  ],
};

const awk: CommandSpec = {
  description: 'Pattern scanning and text processing',
  args: 'path',
  options: [o('-F', 'Set the field separator'), o('-v', 'Assign a variable')],
};

// ── archives ─────────────────────────────────────────────────────────────
const tar: CommandSpec = {
  description: 'Archive files',
  args: 'path',
  options: [
    o('-x', 'Extract an archive'),
    o('-c', 'Create an archive'),
    o('-z', 'Compress with gzip'),
    o('-v', 'Verbose output'),
    o('-f', 'Archive file', 'path'),
    o('-C', 'Change to a directory first', 'dir'),
  ],
};

const zip: CommandSpec = {
  description: 'Create a zip archive',
  args: 'path',
  options: [o('-r', 'Recurse into directories'), o('-e', 'Encrypt the archive')],
};

const unzip: CommandSpec = {
  description: 'Extract a zip archive',
  args: 'path',
  options: [
    o('-l', 'List the archive contents'),
    o('-o', 'Overwrite without prompting'),
    o('-d', 'Extract into a directory', 'dir'),
  ],
};

// ── filesystem basics ────────────────────────────────────────────────────
const chmod: CommandSpec = { description: 'Change file permissions', args: 'path', options: [o('-R', 'Recurse into directories')] };
const chown: CommandSpec = { description: 'Change file owner', args: 'path', options: [o('-R', 'Recurse into directories')] };
const cat: CommandSpec = { description: 'Print file contents', args: 'path', options: [o('-n', 'Number output lines')] };
const ls: CommandSpec = {
  description: 'List directory contents',
  args: 'path',
  options: [o('-l', 'Long listing format'), o('-a', 'Show hidden entries'), o('-h', 'Human-readable sizes')],
};
const cd: CommandSpec = { description: 'Change the working directory', args: 'dir' };
const rmdir: CommandSpec = { description: 'Remove an empty directory', args: 'dir' };
const pushd: CommandSpec = { description: 'Push a directory onto the stack', args: 'dir' };
const mkdir: CommandSpec = { description: 'Create a directory', args: 'path', options: [o('-p', 'Create parent directories too')] };
const rm: CommandSpec = { description: 'Remove files', args: 'path', options: [o('-r', 'Recurse into directories'), o('-f', 'Ignore missing files')] };
const cp: CommandSpec = { description: 'Copy files', args: 'path', options: [o('-r', 'Recurse into directories')] };
const mv: CommandSpec = { description: 'Move or rename a file', args: 'path' };
const touch: CommandSpec = { description: 'Create or update a file', args: 'path' };
const du: CommandSpec = { description: 'Show disk usage', args: 'path', options: [o('-h', 'Human-readable sizes'), o('-s', 'Summarize a directory')] };
const tree: CommandSpec = { description: 'List a directory as a tree', args: 'path' };
const stat: CommandSpec = { description: 'Show file status', args: 'path' };
const file: CommandSpec = { description: 'Determine a file type', args: 'path' };
const diff: CommandSpec = { description: 'Compare files line by line', args: 'path', options: [o('-u', 'Unified diff format')] };
const source: CommandSpec = { description: 'Run a script in the current shell', args: 'path' };
const sh: CommandSpec = { description: 'Run the Bourne shell, or a script', args: 'path' };
const bash: CommandSpec = { description: 'Run bash, or a script', args: 'path' };

const echo: CommandSpec = { description: 'Print text', args: 'none' };
const exportSpec: CommandSpec = { description: 'Set an environment variable', args: 'none' };
const alias: CommandSpec = { description: 'Define a shell alias', args: 'none' };
const history: CommandSpec = { description: 'Show command history', args: 'none' };
const clear: CommandSpec = { description: 'Clear the terminal screen', args: 'none' };
const exit: CommandSpec = { description: 'Exit the shell', args: 'none' };
const which: CommandSpec = { description: 'Locate a command', args: 'command' };
const env: CommandSpec = { description: 'Print or run with a modified environment', args: 'none' };
const pbcopy: CommandSpec = { description: 'Copy stdin to the clipboard', args: 'none' };
const pbpaste: CommandSpec = { description: 'Print the clipboard to stdout', args: 'none' };

// ── editors / pagers ─────────────────────────────────────────────────────
const code: CommandSpec = {
  description: 'Open VS Code',
  args: 'path',
  options: [o('-r', 'Reuse the current window'), o('-n', 'Open a new window')],
};
const vim: CommandSpec = { description: 'Open the Vim editor', args: 'path' };
const nvim: CommandSpec = { description: 'Open the Neovim editor', args: 'path' };
const nano: CommandSpec = { description: 'Open the Nano editor', args: 'path' };
const less: CommandSpec = { description: 'Page through a file', args: 'path' };
const head: CommandSpec = { description: 'Print the first lines of a file', args: 'path', options: [o('-n', 'Number of lines')] };
const tail: CommandSpec = { description: 'Print the last lines of a file', args: 'path', options: [o('-f', 'Follow file growth'), o('-n', 'Number of lines')] };
const open: CommandSpec = { description: 'Open a file with its default app', args: 'path', options: [o('-a', 'Open with a specific application')] };

// ── process tools ────────────────────────────────────────────────────────
const ps: CommandSpec = { description: 'List running processes', args: 'none', options: [o('-e', 'Every process'), o('-f', 'Full-format listing')] };
const kill: CommandSpec = { description: 'Send a signal to a process', args: 'none', options: [o('-9', 'SIGKILL'), o('-15', 'SIGTERM')] };
const lsof: CommandSpec = { description: 'List open files', args: 'none', options: [o('-i', 'List network files'), o('-p', 'Filter by PID')] };

// ── node / python / make / wails3 ────────────────────────────────────────
const node: CommandSpec = {
  description: 'Run JavaScript with Node.js',
  args: 'path',
  options: [o('-e', 'Evaluate a script string'), o('-v', 'Print the version'), o('--watch', 'Restart on file changes')],
};
const python: CommandSpec = {
  description: 'Run the Python interpreter',
  args: 'path',
  options: [o('-m', 'Run a library module'), o('-c', 'Run a command string'), o('-v', 'Print the version')],
};
const make: CommandSpec = {
  description: 'Build automation tool',
  args: 'none',
  options: [
    o('-f', 'Makefile to use', 'path'),
    o('-j', 'Run jobs in parallel'),
    o('-n', 'Print commands without running them'),
    o('-C', 'Change to a directory first', 'dir'),
  ],
};
const wails3: CommandSpec = {
  description: 'Wails v3 CLI',
  subcommands: [
    s('dev', 'Run the app in development mode'),
    s('build', 'Build the production app'),
    s('generate', 'Regenerate bindings or templates'),
  ],
};

export const completionSpecs: CompletionSpecs = {
  git,
  docker,
  npm: packageManager('Node package manager'),
  pnpm: packageManager('Fast, disk-efficient package manager'),
  yarn: packageManager('Node package manager'),
  bun: packageManager('JavaScript runtime and package manager'),
  node,
  go,
  cargo,
  python,
  python3: python,
  pip: pip(),
  pip3: pip(),
  kubectl,
  brew,
  make,
  ssh,
  scp,
  curl,
  wget,
  grep: grepLike('Search text using patterns'),
  rg: grepLike('Recursively search text (ripgrep)'),
  find,
  sed,
  awk,
  tar,
  zip,
  unzip,
  chmod,
  chown,
  ps,
  kill,
  lsof,
  cat,
  ls,
  cd,
  mkdir,
  rm,
  cp,
  mv,
  touch,
  echo,
  export: exportSpec,
  alias,
  source,
  history,
  clear,
  exit,
  which,
  env,
  code,
  vim,
  nvim,
  nano,
  less,
  head,
  tail,
  systemctl,
  open,
  pbcopy,
  pbpaste,
  terraform,
  aws,
  gh,
  wails3,
  rmdir,
  pushd,
  du,
  tree,
  stat,
  file,
  diff,
  sh,
  bash,
};
