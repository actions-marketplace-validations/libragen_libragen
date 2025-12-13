<p align="center">
  <img src="packages/website/public/favicon.svg" alt="Libragen Logo" width="80" height="80">
</p>

<h1 align="center">libragen</h1>

<p align="center">
  <em>(pronounced "LIB-ruh-jen")</em>
</p>

<p align="center">
  <strong>Ground your AI in real documentation—not stale training data</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@libragen/cli"><img src="https://img.shields.io/npm/v/@libragen/cli.svg?label=cli" alt="npm cli"></a>
  <a href="https://www.npmjs.com/package/@libragen/core"><img src="https://img.shields.io/npm/v/@libragen/core.svg?label=core" alt="npm core"></a>
  <a href="https://www.npmjs.com/package/@libragen/mcp"><img src="https://img.shields.io/npm/v/@libragen/mcp.svg?label=mcp" alt="npm mcp"></a>
  <a href="https://github.com/libragen/libragen/actions"><img src="https://github.com/libragen/libragen/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/libragen/libragen/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="https://libragen.dev">Documentation</a> •
  <a href="https://libragen.dev/docs/getting-started">Getting Started</a> •
  <a href="https://libragen.dev/docs/cli">CLI</a> •
  <a href="https://libragen.dev/docs/mcp">MCP Server</a> •
  <a href="https://github.com/libragen/libragen/discussions">Discussions</a>
</p>

---

Create private, local RAG libraries from any documentation. Libraries are single SQLite files you can share with your team—no cloud, no API keys.

## Why libragen?

- **Stop hallucinations** — Give AI agents authoritative docs to cite instead of guessing
- **Always current** — Rebuild when docs change; your AI gets the latest APIs
- **Private & local** — Everything runs on your machine, nothing leaves your network
- **Shareable** — Single `.libragen` files work anywhere

## Packages

| Package | Description |
|---------|-------------|
| [`@libragen/cli`](./packages/cli) | Build and query libraries from the command line |
| [`@libragen/mcp`](./packages/mcp) | Connect AI assistants to your libraries via MCP |
| [`@libragen/core`](./packages/core) | Programmatic API for embedding, search, and library management |

## Quick Start

### 1. Build a library

```bash
# From local docs
npx @libragen/cli build ./your-private-docs --name company-docs

# From a git repository
npx @libragen/cli build https://github.com/anthropics/anthropic-cookbook --name anthropic-cookbook
```

### 2. Connect your AI

```bash
npx -y install-mcp @libragen/mcp
```

Restart your AI tool (Claude Desktop, VS Code, Cursor, etc.). Libraries in your global directory are now searchable.

### 3. Ask questions

> "How do I implement tool use with Claude's API?"

> "What's our internal policy on deploying to production?"

> "Show me examples of streaming responses from the Anthropic cookbook"

Your AI retrieves relevant documentation and responds with accurate, cited answers—not hallucinated guesses from 2-year-old training data.

## What else can you do?

- **Chat with your Obsidian vault** — [Tutorial →](https://libragen.dev/docs/tutorial-obsidian)
- **Make your company's internal docs searchable** — Runbooks, wikis, policies—all queryable by AI
- **Create a shared library for your team** — One `.libragen` file, everyone's on the same page
- **Auto-build libraries in CI** — Use the [GitHub Action](https://github.com/libragen/libragen) to generate `.libragen` files on every push

---

**[Full documentation →](https://libragen.dev)**

## License

MIT — see [LICENSE](./LICENSE) for details.
