---
title: API Reference
description: TypeScript API for @libragen/core
section: Reference
order: 11
---

The `@libragen/core` package provides programmatic access to libragen functionality.

## Installation

```bash
npm install --save-exact @libragen/core
```

## Quick Example

### Building a Library

```typescript
import { Builder } from '@libragen/core';

const builder = new Builder();

// Build from local directory
const result = await builder.build('./docs', {
  name: 'my-docs',
  version: '1.0.0',
  description: 'My documentation library',
});

console.log(`Built: ${result.outputPath}`);
console.log(`Chunks: ${result.stats.chunkCount}`);
```

### Searching a Library

```typescript
import { Embedder, VectorStore, Searcher } from '@libragen/core';

const embedder = new Embedder();
await embedder.initialize();

const store = new VectorStore('./my-library.libragen');
store.initialize();

const searcher = new Searcher(embedder, store);
const results = await searcher.search({ query: 'How do I authenticate?', k: 5 });

for (const result of results) {
  console.log(`[${result.score.toFixed(2)}] ${result.source}`);
  console.log(result.content);
}
```

## Classes

### `Builder`

High-level API for building `.libragen` libraries from source files or git repositories.

```typescript
import { Builder } from '@libragen/core';

const builder = new Builder();

// Build from local source
const result = await builder.build('./src', {
  name: 'my-library',
  version: '1.0.0',
  description: 'My library',
  chunkSize: 1000,
  chunkOverlap: 100,
});

// Build from git repository
const gitResult = await builder.build('https://github.com/user/repo', {
  gitRef: 'main',
  include: ['docs/**/*.md'],
});

// With progress callback
await builder.build('./docs', { name: 'my-docs' }, (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});
```

#### Build Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `output` | string | — | Output path for .libragen file |
| `name` | string | — | Library name |
| `version` | string | `'0.1.0'` | Library version |
| `description` | string | — | Short description |
| `chunkSize` | number | `1000` | Target chunk size in characters |
| `chunkOverlap` | number | `100` | Overlap between chunks |
| `include` | string[] | — | Glob patterns to include |
| `exclude` | string[] | — | Glob patterns to exclude |
| `gitRef` | string | — | Git branch/tag/commit |
| `license` | string[] | — | SPDX license identifiers |

#### Build Result

```typescript
interface BuildResult {
  outputPath: string;      // Absolute path to .libragen file
  metadata: LibraryMetadata;
  stats: {
    chunkCount: number;
    sourceCount: number;
    fileSize: number;
    embedDuration: number;
    chunksPerSecond: number;
  };
  git?: {
    commitHash: string;
    ref: string;
    detectedLicense?: { identifier: string; confidence: string };
  };
}
```

---

### `Embedder`

Generates vector embeddings from text using a local transformer model. Implements the `IEmbedder` interface.

```typescript
import { Embedder } from '@libragen/core';

const embedder = new Embedder({
  model: 'Xenova/bge-small-en-v1.5', // default
  quantization: 'q8', // quantized for speed
});

await embedder.initialize();

// Generate embedding for a single text
const embedding = await embedder.embed('Hello world');
// Returns: Float32Array(384)

// Generate embeddings for multiple texts (batched)
const embeddings = await embedder.embedBatch([
  'First document',
  'Second document',
]);
// Returns: Float32Array(384)[]

// Clean up when done
await embedder.dispose();
```

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | `Xenova/bge-small-en-v1.5` | HuggingFace model ID |
| `quantization` | `'fp32' \| 'fp16' \| 'q8' \| 'q4'` | `'q8'` | Model precision |

---

### `IEmbedder` Interface

Interface for custom embedding implementations. Use this to integrate external embedding services like OpenAI, Cohere, or other providers.

```typescript
import type { IEmbedder } from '@libragen/core';

class OpenAIEmbedder implements IEmbedder {
  dimensions = 1536; // text-embedding-3-small

  async initialize() {
    // Setup OpenAI client
  }

  async embed(text: string): Promise<Float32Array> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return new Float32Array(response.data[0].embedding);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map(d => new Float32Array(d.embedding));
  }

  async dispose() {
    // Cleanup if needed
  }
}

// Use with Builder
const builder = new Builder({ embedder: new OpenAIEmbedder() });

// Use with Searcher
const searcher = new Searcher(new OpenAIEmbedder(), store);
```

#### Interface Methods

| Method | Description |
|--------|-------------|
| `dimensions` | The dimensionality of embedding vectors (readonly) |
| `initialize()` | Initialize the embedder (called before embedding) |
| `embed(text)` | Embed a single text string |
| `embedBatch(texts)` | Embed multiple texts |
| `dispose()` | Clean up resources |

---

### `VectorStore`

SQLite-based storage for vectors, metadata, and full-text search.

```typescript
import { VectorStore } from '@libragen/core';

// Open existing library
const store = new VectorStore('./my-library.libragen');

// Create new library
const store = new VectorStore('./new-library.libragen', {
  create: true,
  metadata: {
    name: 'my-library',
    description: 'My documentation',
    contentVersion: '1.0.0',
  },
});

// Add chunks
await store.addChunks([
  {
    content: 'Document content here...',
    source: 'docs/getting-started.md',
    embedding: await embedder.embed('Document content here...'),
  },
]);

// Get metadata
const meta = store.getMetadata();
console.log(meta.name, meta.chunkCount);

// Close when done
store.close();
```

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `create` | boolean | `false` | Create new database if doesn't exist |
| `metadata` | object | — | Library metadata (required when creating) |

#### Methods

| Method | Description |
|--------|-------------|
| `addChunks(chunks)` | Add document chunks with embeddings |
| `getMetadata()` | Get library metadata |
| `vectorSearch(embedding, k)` | Search by vector similarity |
| `ftsSearch(query, k)` | Full-text search |
| `close()` | Close database connection |

---

### `Searcher`

Hybrid search combining vector similarity and full-text search.

```typescript
import { Searcher } from '@libragen/core';

const searcher = new Searcher(embedder, store);

const results = await searcher.search({
  query: 'authentication methods',
  k: 10,
  contentVersion: '2.0.0', // optional filter
});

for (const result of results) {
  console.log({
    score: result.score,
    source: result.source,
    content: result.content,
  });
}
```

#### Search Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `query` | string | — | Search query text (required) |
| `k` | number | `10` | Number of results |
| `hybridAlpha` | number | `0.5` | Balance between vector (1) and keyword (0) search |
| `rerank` | boolean | `false` | Apply reranking for better results |
| `contentVersion` | string | — | Filter by version |

---

### `Chunker`

Split documents into chunks for indexing.

```typescript
import { Chunker } from '@libragen/core';

const chunker = new Chunker({
  chunkSize: 512,
  chunkOverlap: 50,
});

const chunks = chunker.chunk('Long document content...', {
  source: 'docs/guide.md',
});

// Returns: { content: string, source: string }[]
```

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chunkSize` | number | `512` | Target chunk size in tokens |
| `chunkOverlap` | number | `50` | Overlap between chunks |

---

## Configuration Helpers

```typescript
import {
  getLibragenHome,
  getDefaultLibraryDir,
  getModelCacheDir,
} from '@libragen/core';

// Get base config directory
const home = getLibragenHome();
// macOS: ~/Library/Application Support/libragen

// Get default library storage location
const libDir = getDefaultLibraryDir();
// macOS: ~/Library/Application Support/libragen/libraries

// Get model cache directory
const modelDir = getModelCacheDir();
// macOS: ~/Library/Application Support/libragen/models
```

Override with environment variables:
- `LIBRAGEN_HOME` - Base directory
- `LIBRAGEN_MODEL_CACHE` - Model cache location

> **Tip:** Run `libragen config` to see current paths and active environment variables.

---

## Types

### `SearchResult`

```typescript
interface SearchResult {
  /** Relevance score (higher = more relevant) */
  score: number;

  /** Source file path */
  source: string;

  /** Chunk content */
  content: string;

  /** Content version if set */
  contentVersion?: string;
}
```

### `LibraryMetadata`

```typescript
interface LibraryMetadata {
  name: string;
  description?: string;
  contentVersion?: string;
  chunkCount: number;
  createdAt: string;
}
```

### `Chunk`

```typescript
interface Chunk {
  content: string;
  source: string;
  embedding: Float32Array;
  metadata?: Record<string, unknown>;
}
```

---

## Library Management

### `LibraryManager`

Manages installed libraries across multiple locations (project-local and global).

```typescript
import { LibraryManager } from '@libragen/core';

// Default: auto-detect .libragen/libraries in cwd + global directory
const manager = new LibraryManager();

// Or use explicit paths only (no global, no auto-detection)
const customManager = new LibraryManager({
  paths: ['.libragen/libraries', '/shared/libs'],
});

// List installed libraries
const libraries = await manager.listInstalled();
for (const lib of libraries) {
  console.log(`${lib.name} v${lib.version} [${lib.location}]`);
}

// Find a specific library (searches paths in order)
const lib = await manager.find('my-lib');

// Install a library (defaults to global directory)
await manager.install('./my-lib.libragen', { force: true });

// Uninstall
await manager.uninstall('my-lib');
```

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `paths` | string[] | — | Explicit paths to use (excludes global and auto-detection) |
| `autoDetect` | boolean | `true` | Auto-detect `.libragen/libraries` in cwd |
| `includeGlobal` | boolean | `true` | Include global directory |
| `cwd` | string | `process.cwd()` | Current working directory for auto-detection |

#### Methods

| Method | Description |
|--------|-------------|
| `listInstalled()` | List all installed libraries across all paths |
| `find(name)` | Find a library by name (first path wins) |
| `install(source, options?)` | Install a library from file or URL |
| `uninstall(name)` | Remove an installed library |
| `getPrimaryDirectory()` | Get the primary install location |

---

## Update Checking

Utilities for checking and applying library updates from collections.

```typescript
import {
  LibraryManager,
  CollectionClient,
  checkForUpdate,
  findUpdates,
  performUpdate,
} from '@libragen/core';

const manager = new LibraryManager();
const client = new CollectionClient();
await client.loadConfig();

// Get installed libraries
const installed = await manager.listInstalled();

// Find all available updates
const updates = await findUpdates(installed, client, { force: false });

for (const update of updates) {
  console.log(`${update.name}: ${update.currentVersion} → ${update.newVersion}`);

  // Apply the update
  await performUpdate(update, manager);
}
```

### `UpdateCandidate`

```typescript
interface UpdateCandidate {
  name: string;
  currentVersion: string;
  currentContentVersion?: string;
  newVersion: string;
  newContentVersion?: string;
  source: string;  // Download URL
  location?: 'global' | 'project';
}
```

---

## Sources

### `FileSource`

Read files from the local filesystem.

```typescript
import { FileSource } from '@libragen/core';

const source = new FileSource();

const files = await source.getFiles({
  paths: ['./src', './docs'],
  patterns: ['**/*.ts', '**/*.md'],
  ignore: ['**/node_modules/**'],
  maxFileSize: 1024 * 1024, // 1MB
});
```

### `GitSource`

Clone and read files from git repositories. Automatically detects licenses.

```typescript
import { GitSource } from '@libragen/core';

const source = new GitSource();

const result = await source.getFiles({
  url: 'https://github.com/user/repo',
  ref: 'main',
  depth: 1,
  patterns: ['**/*.ts'],
});

console.log(result.files);           // Array of source files
console.log(result.commitHash);      // Full commit SHA
console.log(result.detectedLicense); // { identifier: 'MIT', confidence: 'high' }

// Clean up temp directory for remote repos
if (result.tempDir) {
  await source.cleanup(result.tempDir);
}
```

### Git URL Utilities

Helper functions for working with git URLs.

```typescript
import { isGitUrl, parseGitUrl, getAuthToken, detectGitProvider } from '@libragen/core';

// Check if a string is a git URL
isGitUrl('https://github.com/user/repo');  // true
isGitUrl('/local/path');  // false

// Parse a git URL into components
const parsed = parseGitUrl('https://github.com/vercel/next.js/tree/main/docs');
// { repoUrl: 'https://github.com/vercel/next.js', ref: 'main', path: 'docs' }

// Get auth token for a repo (checks environment variables)
const token = getAuthToken('https://github.com/user/repo');
// Checks GITHUB_TOKEN for GitHub; GITLAB_TOKEN for GitLab, etc.

// Detect git provider from URL
detectGitProvider('https://github.com/user/repo');  // 'github'
detectGitProvider('https://gitlab.com/user/repo');  // 'gitlab'
```

### `LicenseDetector`

Detect SPDX license identifiers from license files.

```typescript
import { LicenseDetector } from '@libragen/core';

const detector = new LicenseDetector();

// Detect from file content
const result = detector.detectFromContent(licenseText);
// { identifier: 'MIT', confidence: 'high' }

// Detect from a directory
const detected = await detector.detectFromDirectory('./my-project');
// { identifier: 'Apache-2.0', file: 'LICENSE', confidence: 'high' }
```

**Supported licenses:** MIT, Apache-2.0, GPL-3.0, GPL-2.0, LGPL-3.0, LGPL-2.1, BSD-3-Clause, BSD-2-Clause, ISC, Unlicense, MPL-2.0, CC0-1.0, AGPL-3.0

---

## Migrations

Schema migration utilities for upgrading library files between versions.

```typescript
import {
  MigrationRunner,
  CURRENT_SCHEMA_VERSION,
  MigrationRequiredError,
  SchemaVersionError,
} from '@libragen/core';

const runner = new MigrationRunner();

try {
  const result = await runner.migrateIfNeeded('./library.libragen');
  if (result.migrated) {
    console.log(`Migrated from v${result.fromVersion} to v${result.toVersion}`);
  }
} catch (e) {
  if (e instanceof MigrationRequiredError) {
    console.log('Migration required but not run (use force option)');
  }
  if (e instanceof SchemaVersionError) {
    console.log('Unsupported schema version');
  }
}

console.log(`Current schema version: ${CURRENT_SCHEMA_VERSION}`);
```

---

## Utilities

### `formatBytes`

Format bytes into a human-readable string.

```typescript
import { formatBytes } from '@libragen/core';

formatBytes(1536);      // "1.5 KB"
formatBytes(1048576);   // "1 MB"
formatBytes(0);         // "0 Bytes"
```

### `formatDuration`

Format seconds into a human-readable duration.

```typescript
import { formatDuration } from '@libragen/core';

formatDuration(45.5);   // "45.5s"
formatDuration(90);     // "1m 30s"
formatDuration(120);    // "2m"
```

### `deriveGitLibraryName`

Derive a library name from a git repository URL.

```typescript
import { deriveGitLibraryName } from '@libragen/core';

deriveGitLibraryName('https://github.com/vercel/next.js.git');  // "vercel-next.js"
deriveGitLibraryName('https://github.com/microsoft/typescript'); // "microsoft-typescript"
```

### Time Estimation

Estimate embedding time based on system capabilities.

```typescript
import { getSystemInfo, estimateEmbeddingTime, formatSystemInfo } from '@libragen/core';

// Get system information
const info = getSystemInfo();
console.log(info.cpuModel);      // "Apple M2 Pro"
console.log(info.cpuCores);      // 12
console.log(info.totalMemoryGB); // 32

// Estimate time for embedding chunks
const estimate = estimateEmbeddingTime(500);
console.log(estimate.estimatedSeconds);  // 10
console.log(estimate.formattedTime);     // "10s"
console.log(estimate.chunksPerSecond);   // 50

// Format system info for display
console.log(formatSystemInfo(info));  // "Apple M2 Pro (12 cores)"
```

The estimation accounts for different CPU types:
- Apple Silicon (M1-M4): 35-70 chunks/second
- Intel/AMD x64: 10-30 chunks/second
- ARM Linux: 8-20 chunks/second

---

## Acknowledgments

libragen uses the following open-source models:

- **[BGE-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5)** — Embedding model by BAAI (MIT License)
- **[mxbai-rerank-xsmall-v1](https://huggingface.co/mixedbread-ai/mxbai-rerank-xsmall-v1)** — Reranking model by Mixedbread (Apache-2.0)

If you use libragen in academic work, please cite the underlying models:

```bibtex
@misc{bge_embedding,
  title={C-Pack: Packaged Resources To Advance General Chinese Embedding},
  author={Shitao Xiao and Zheng Liu and Peitian Zhang and Niklas Muennighoff},
  year={2023},
  eprint={2309.07597},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}

@online{rerank2024mxbai,
  title={Boost Your Search With The Crispy Mixedbread Rerank Models},
  author={Aamir Shakir and Darius Koenig and Julius Lipp and Sean Lee},
  year={2024},
  url={https://www.mixedbread.ai/blog/mxbai-rerank-v1},
}
```
