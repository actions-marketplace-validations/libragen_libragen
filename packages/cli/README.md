<p align="center">
  <img src="https://libragen.dev/favicon.svg" alt="Libragen Logo" width="80" height="80">
</p>

<h1 align="center">@libragen/cli</h1>

<p align="center">
  <strong>Build and manage RAG libraries from the command line</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@libragen/cli"><img src="https://img.shields.io/npm/v/@libragen/cli.svg" alt="npm"></a>
  <a href="https://github.com/libragen/libragen/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="https://libragen.dev/docs/mcp">MCP Server</a> •
  <a href="https://libragen.dev/docs/api">Core API</a>
</p>

---

Create private, local RAG libraries from documentation. Build from local files or git repositories, then search with natural language or connect to AI assistants via MCP.

**[Full documentation →](https://libragen.dev/docs/cli)**

## Installation

```bash
npm install -g @libragen/cli
```

Or use with npx:

```bash
npx @libragen/cli <command>
```

## Typical Workflow

### 1. Build a library

```bash
# From local docs
libragen build ./your-private-docs --name company-docs

# From a git repository
libragen build https://github.com/anthropics/anthropic-cookbook --name anthropic-cookbook
```

### 2. Connect your AI

```bash
npx -y install-mcp @libragen/mcp
```

Restart your AI tool (Claude Desktop, VS Code, Cursor, etc.). Libraries in your global directory are now searchable.

### 3. Search with natural language

```bash
# Query from the command line
libragen query "how to implement tool use" -l anthropic-cookbook

# Or just ask your AI directly!
```

### 4. Manage your libraries

```bash
# See what's installed
libragen list

# Remove a library
libragen uninstall anthropic-cookbook

# Check for updates
libragen update --dry-run
```

## Commands

| Command | Description |
|---------|-------------|
| [`build`](https://libragen.dev/docs/cli#build) | Build a library from files or git repo |
| [`query`](https://libragen.dev/docs/cli#query) | Search a library for relevant content |
| [`inspect`](https://libragen.dev/docs/cli#inspect) | Display library or collection metadata |
| [`list`](https://libragen.dev/docs/cli#list) | List installed libraries |
| [`install`](https://libragen.dev/docs/cli#install) | Install a library or collection |
| [`uninstall`](https://libragen.dev/docs/cli#uninstall) | Remove an installed library |
| [`update`](https://libragen.dev/docs/cli#update) | Update libraries from collections |
| [`collection`](https://libragen.dev/docs/cli#collection) | Create and manage collections |
| [`config`](https://libragen.dev/docs/cli#config) | Display configuration and paths |
| [`completions`](https://libragen.dev/docs/cli#completions) | Manage shell completions |

## Related

- [@libragen/core](../core) — Programmatic API
- [@libragen/mcp](../mcp) — MCP server for AI assistants

**[Full CLI reference →](https://libragen.dev/docs/cli)**
