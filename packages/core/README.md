<p align="center">
  <img src="https://libragen.dev/favicon.svg" alt="Libragen Logo" width="80" height="80">
</p>

<h1 align="center">@libragen/core</h1>

<p align="center">
  <strong>Programmatic API for building and searching RAG libraries</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@libragen/core"><img src="https://img.shields.io/npm/v/@libragen/core.svg" alt="npm"></a>
  <a href="https://github.com/libragen/libragen/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="https://libragen.dev/docs/cli">CLI</a> •
  <a href="https://libragen.dev/docs/mcp">MCP Server</a> •
  <a href="https://libragen.dev/docs/api">API</a>
</p>

---

Build and query libragen libraries programmatically. This package provides embedding, chunking, vector storage, and hybrid search—everything you need to create RAG-ready documentation libraries in your own applications.

> **Most users should start with [@libragen/cli](../cli) (command line) or [@libragen/mcp](../mcp) (AI assistants).** This package is for building custom integrations.

**[Full documentation →](https://libragen.dev/docs/api)**

## Installation

```bash
npm install --save-exact @libragen/core
```

## Quick Start

### Build a Library

```typescript
import { Builder } from '@libragen/core';

const builder = new Builder();
const result = await builder.build('./docs', {
  name: 'my-docs',
  version: '1.0.0',
  description: 'My documentation library',
});

console.log(`Built: ${result.outputPath}`);
console.log(`Chunks: ${result.stats.chunkCount}`);
```

### Search a Library

```typescript
import { Embedder, VectorStore, Searcher } from '@libragen/core';

const embedder = new Embedder();
await embedder.initialize();

const store = new VectorStore('./my-docs-1.0.0.libragen');
store.initialize();

const searcher = new Searcher(embedder, store);
const results = await searcher.search({ query: 'authentication', k: 5 });

for (const result of results) {
  console.log(`[${result.score.toFixed(2)}] ${result.sourceFile}`);
  console.log(result.content);
}

await embedder.dispose();
store.close();
```

## API

| Class | Description |
|-------|-------------|
| [`Builder`](https://libragen.dev/docs/api#builder) | Build `.libragen` files from source files or git repos |
| [`Embedder`](https://libragen.dev/docs/api#embedder) | Generate vector embeddings (BGE-small-en-v1.5) |
| [`Searcher`](https://libragen.dev/docs/api#searcher) | Hybrid vector + keyword search with optional reranking |
| [`VectorStore`](https://libragen.dev/docs/api#vectorstore) | SQLite-based storage with sqlite-vec and FTS5 |
| [`LibraryManager`](https://libragen.dev/docs/api#librarymanager) | Install, uninstall, and discover libraries |

**[Full API reference →](https://libragen.dev/docs/api)**
