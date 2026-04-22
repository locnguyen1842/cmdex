<!-- generated-by: gsd-doc-writer -->

# Getting Started

This guide will walk you through setting up the Cmdex project for local development and building it from source.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Go** `>= 1.25.0`
- **Node.js** `>= 25`
- **pnpm** (required for frontend dependencies)
- **Wails v3 CLI** (`v3.0.0-alpha.74`)
- **Task** (optional, used by build scripts — install from [taskfile.dev](https://taskfile.dev))

### Platform-specific dependencies

- **Linux**: Install system libraries required for the WebKit renderer:
  ```bash
  sudo apt-get update
  sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev
  ```

- **Windows**: NSIS is required to build the installer. Install it with:
  ```powershell
  choco install nsis
  ```

- **macOS**: No extra system dependencies are required.

## Installation steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/locnguyen1842/cmdex.git
   cd cmdex
   ```

2. **Install the Wails v3 CLI**
   ```bash
   go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-alpha.74
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend && pnpm install
   ```

## Running in development mode

Start the application with hot-reload for the frontend:

```bash
wails3 dev
```

Or use Task (respects the project `.env` configuration):

```bash
task dev
```

> **Note:** Frontend changes are reloaded automatically. Changes to Go code require restarting the dev server.

## Building for production

### Quick build

Build a native binary for your current platform:

```bash
wails3 build
```

### Using Task (recommended)

The project includes a `Taskfile.yml` that orchestrates platform-specific builds:

| Command | Description |
|---------|-------------|
| `task build` | Build the application for the current OS |
| `task package` | Build and package a production release (installer/disk image) |
| `task package:universal` | Build a universal macOS binary (arm64 + amd64) |

The packaged artifacts are placed in the `bin/` directory.

## First-time setup

No additional configuration is required to run the app locally. On first launch, Cmdex automatically creates its local data directory and database at:

```
~/.cmdex/cmdex.db
```

All data is stored locally — no accounts, cloud services, or API keys are needed.

The project includes pre-configured environment files (`.env` and `frontend/.env`) that set the application name and development server port. You should not need to modify these for standard development.
