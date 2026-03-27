# Commamer

Commamer is a cross-platform desktop application designed to help users save, organize, and execute CLI commands with dynamic variable placeholders. Built with Go, Wails, and React TypeScript, it offers a fast, native-like experience with a modern dark-themed interface.

## Features

- **Categorized Storage**: Organize your commands into custom categories with unique colors.
- **Variable Placeholders**: Store commands like `redis-cli --scan --pattern ${pattern}`. When you execute the command, Commamer will automatically prompt you for the `${pattern}` value.
- **In-App Execution**: Run commands directly within the app and view standard output/error in an integrated terminal panel.
- **Quick Search**: Instantly filter your commands by title, description, tags, or the command text itself.
- **Local JSON Storage**: All data is securely stored locally in `~/.commamer/data.json`. No external databases or cloud synchronization required.
- **Modern UI**: A premium dark theme featuring glassmorphism effects, smooth animations, and a responsive layout.

## Tech Stack

- **Backend**: [Go](https://go.dev/)
- **Desktop Framework**: [Wails v2](https://wails.io/)
- **Frontend**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)

## Prerequisites

To build and run Commamer, you need:

- Go 1.18+
- Node.js 16+
- npm (or yarn/pnpm)
- Wails CLI v2

To install the Wails CLI:
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Getting Started

1. **Clone the repository** (if applicable):
   ```bash
   git clone <repo-url>
   cd commamer
   ```

2. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. **Run in development mode**:
   Development mode provides hot-reloading for the frontend and automatically rebuilds the Go backend on changes.
   ```bash
   wails dev
   ```

4. **Build for production**:
   To compile Commamer into a standalone production binary:
   ```bash
   wails build
   ```
   The finished binary will be placed in the `build/bin` directory.

## App Structure

- `main.go`: Application entry point and window configuration.
- `app.go`: Contains the Go structs and bound methods exposed to the JS frontend.
- `models.go`: Defines the core data structures (Command, Category, etc.).
- `store.go`: Handles reading/writing the JSON database thread-safely.
- `executor.go`: Parses variables and executes shell commands natively via `os/exec`.
- `frontend/`: The Vite + React frontend project.

## Variable Syntax

To create a command with a promptable variable, use `${...}` syntax (compatible with JavaScript template literals).

**Example:**
`docker logs -f --tail ${lines} ${container_name}`

When executed, Commamer will pop up a modal asking for `lines` and `container_name`, then substitute them into the command before running it.

## License

MIT License
