# libragen: First-Class AST-Aware Code Chunking Support

**Version:** 1.0.0
**Date:** 2024-12-20
**Status:** In Progress

## Summary

Integrate the `code-chunk` library from supermemoryai to provide AST-aware, semantic
code chunking as a first-class feature in libragen. This replaces the current
LangChain-based `RecursiveCharacterTextSplitter` for supported code files with
tree-sitter-powered chunking that respects semantic boundaries (functions, classes,
methods) and provides rich context (scope chains, imports, siblings, entity signatures)
for better embedding quality.

## Objectives & Scope

### In Scope

- **Add `code-chunk` as a dependency** to `@libragen/core`
- **Create a new `CodeChunker` class** that wraps `code-chunk` and implements the same
  interface pattern as the existing `Chunker`
- **Extend `Chunk` and `ChunkMetadata` types** to include semantic context from code-chunk
  (scope, entities, imports, siblings)
- **Update `Builder`** to use `CodeChunker` for supported code files, falling back to the
  existing `Chunker` for unsupported files
- **Store semantic context** in the database for retrieval-time enrichment
- **Store `contextualizedText`** in the database alongside raw content for maximum
  flexibility
- **Update CLI and MCP** to expose new chunking options (e.g., `--no-ast-chunking`,
  `--context-mode`)
- **Add build option** to enable/disable AST-aware chunking (default: enabled for code
  files)
- **Update documentation** across all packages

### Out of Scope

- WASM/Cloudflare Workers support (code-chunk supports this, but libragen is
  Node.js-focused)
- Effect.js integration (use Promise-based API)
- Streaming chunking API (batch processing is sufficient for build)

### Future Considerations

- **Custom tree-sitter grammar support** beyond what code-chunk provides - this would
  allow users to add support for additional languages by providing their own tree-sitter
  grammars

## Assumptions & Open Questions

### Assumptions

- `code-chunk` is stable enough for production use (v0.1.11)
- The `contextualizedText` field from code-chunk is suitable for embedding (this is its
  intended use)
- Node.js native tree-sitter bindings will work in libragen's target environments
  (Node 24+)
- Users will benefit from richer chunk context even if it increases storage slightly

### Resolved Questions

1. **Should AST chunking be opt-in or opt-out?**
   - **Answer:** Opt-out (enabled by default for code files)

2. **Should we store both raw `text` and `contextualizedText`?**
   - **Answer:** Yes, store both. Use `contextualizedText` for embeddings, store raw
     `content` for display. This provides maximum flexibility and highest quality output.

3. **How should we handle files that code-chunk doesn't support?**
   - **Answer:** Fall back to existing `Chunker`

4. **Should chunk context (scope, entities, etc.) be stored in the database?**
   - **Answer:** Yes, in the metadata JSON column

5. **What about backward compatibility with old libraries?**
   - **Answer:** Old libraries won't have semantic context data, but CLI/MCP should
     handle both old and new formats gracefully without errors

## Requirements

### Functional

- **FR-1**: Support AST-aware chunking for TypeScript, JavaScript, Python, Rust, Go, and
  Java files
- **FR-2**: Fall back to existing text-based chunking for unsupported file types
- **FR-3**: Store semantic context (scope chain, entities, imports, siblings) in chunk
  metadata
- **FR-4**: Store `contextualizedText` in the database for embedding and retrieval
- **FR-5**: Use `contextualizedText` for embedding generation to improve retrieval quality
- **FR-6**: Expose `--no-ast-chunking` flag in CLI to disable AST-aware chunking
- **FR-7**: Expose `--context-mode` option (`none`, `minimal`, `full`) for controlling
  context richness (default: `full`)
- **FR-8**: Maintain backward compatibility with existing `.libragen` files
- **FR-9**: CLI and MCP must handle libraries with and without semantic context gracefully

### Non-Functional

- **NFR-1 (Performance)**: AST chunking should not significantly increase build time
  (tree-sitter is fast)
- **NFR-2 (Storage)**: Chunk metadata storage increase should be reasonable (<30% file
  size increase due to storing contextualizedText)
- **NFR-3 (Compatibility)**: Must work with Node.js 24+ on macOS, Linux, and Windows

## Architecture & Design Overview

### Data Flow

```
Source Files
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ Builder._chunkSource()                                   │
│   ├─ For each file:                                      │
│   │   ├─ Is code file supported by code-chunk?           │
│   │   │   ├─ YES → CodeChunker.chunkText()               │
│   │   │   │         └─ Returns Chunk[] with context      │
│   │   │   │            + embeddingContent                │
│   │   │   └─ NO  → Chunker.chunkText() (existing)        │
│   │   │             └─ Returns Chunk[] (basic metadata)  │
│   │   └─ Collect all chunks                              │
└─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ Builder._generateEmbeddings()                            │
│   └─ Use chunk.embeddingContent ?? chunk.content         │
│      (contextualizedText for code, raw for others)       │
└─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ VectorStore.addChunks()                                  │
│   └─ Store:                                              │
│      - chunk.content (raw text for display)              │
│      - chunk.embeddingContent (contextualizedText)       │
│      - chunk.metadata (includes codeContext)             │
└─────────────────────────────────────────────────────────┘
```

### Key Interfaces

```typescript
// Semantic context from code-chunk
interface CodeContext {
  scope: EntityInfo[];        // Scope chain (e.g., class > method)
  entities: ChunkEntityInfo[]; // Entities defined in this chunk
  siblings: SiblingInfo[];     // Nearby entities for context
  imports: ImportInfo[];       // Relevant imports
}

// Extended ChunkMetadata
interface ChunkMetadata {
  sourceFile: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  // NEW: Semantic context from code-chunk
  codeContext?: CodeContext;
}

// Extended Chunk
interface Chunk {
  content: string;              // Raw code text (for display)
  embeddingContent?: string;    // contextualizedText (for embedding)
  metadata: ChunkMetadata;
}
```

### Database Schema Changes

The `chunks` table already has a `metadata` JSON column. We will:

1. Store `codeContext` in the metadata JSON
2. Add a new column `embedding_content` to store `contextualizedText` separately from
   `content`

This allows:
- Displaying raw code to users
- Using enriched context for embeddings
- Retrieving semantic context at search time

### Decisions & Trade-offs

- **Decision**: Store both `content` and `embeddingContent` (contextualizedText)
  - **Rationale**: Maximum flexibility - raw content for display, contextualized for
    embeddings and potential re-embedding
  - **Trade-off**: ~20-30% storage increase, but worth it for quality

- **Decision**: Store semantic context in metadata JSON column
  - **Rationale**: Enables rich retrieval-time features without schema migration
  - **Trade-off**: Increases storage, but provides valuable context

- **Decision**: Default to AST chunking with `contextMode: 'full'`
  - **Rationale**: Best quality out of the box
  - **Trade-off**: Users who want smaller files can opt out

- **Decision**: Graceful fallback for unsupported files and old libraries
  - **Rationale**: Seamless experience regardless of file type or library age
  - **Trade-off**: Some code paths need to handle both cases

## Task Grid

| Status | ID | Task | Priority | Depends On | Acceptance Criteria |
|---|---|---|---|---|---|
| [ ] | T-01 | Add `code-chunk` dependency | H | — | Package installed, types available |
| [ ] | T-02 | Extend `Chunk` and `ChunkMetadata` types | H | T-01 | Types include semantic context fields |
| [ ] | T-03 | Create `CodeChunker` class | H | T-02 | Class wraps code-chunk, matches Chunker pattern |
| [ ] | T-04 | Update `Builder` to use `CodeChunker` | H | T-03 | Builder uses AST chunking for supported files |
| [ ] | T-05 | Update `VectorStore` schema | M | T-02 | `embedding_content` column added |
| [ ] | T-06 | Add build options for AST chunking | M | T-04 | `noAstChunking`, `contextMode` options work |
| [ ] | T-07 | Update CLI with new options | M | T-06 | `--no-ast-chunking`, `--context-mode` flags |
| [ ] | T-08 | Update MCP tools with new options | M | T-06 | MCP build tool accepts new options |
| [ ] | T-09 | Write unit tests | H | T-03, T-04 | ≥90% coverage for new code |
| [ ] | T-10 | Update documentation | M | T-07, T-08 | READMEs, website docs updated |

## Task Details

### T-01 — Add `code-chunk` dependency

**Goal:** Install `code-chunk` package in `@libragen/core`.

**Step-by-step instructions:**

1. Run `npm install --save-exact code-chunk` in `packages/core`
2. Verify TypeScript types are available
3. Test basic import: `import { chunk, detectLanguage } from 'code-chunk'`

---

### T-02 — Extend `Chunk` and `ChunkMetadata` types

**Goal:** Add semantic context fields to chunk types.

**Step-by-step instructions:**

1. Update `packages/core/src/chunker.ts`:
   - Add `CodeContext` interface with scope, entities, siblings, imports
   - Add `codeContext?: CodeContext` to `ChunkMetadata`
   - Add `embeddingContent?: string` to `Chunk` interface
2. Export new types from `packages/core/src/index.ts`

---

### T-03 — Create `CodeChunker` class

**Goal:** Create a wrapper around `code-chunk` that matches the `Chunker` interface
pattern.

**Step-by-step instructions:**

1. Create `packages/core/src/code-chunker.ts`
2. Implement `CodeChunker` class with:
   - `static isSupported(filePath: string): boolean` - check if file is supported
   - `static detectLanguage(filePath: string): Language | null`
   - `async chunkText(content: string, filePath: string): Promise<Chunk[]>`
   - `async chunkFile(filePath: string): Promise<Chunk[]>`
   - `async chunkSourceFiles(files: SourceFile[]): Promise<Chunk[]>`
3. Map code-chunk's `Chunk` type to libragen's `Chunk` type
4. Handle errors gracefully (fall back to null/empty on parse errors)

---

### T-04 — Update `Builder` to use `CodeChunker`

**Goal:** Integrate `CodeChunker` into the build pipeline.

**Step-by-step instructions:**

1. Update `packages/core/src/builder.ts`:
   - Import `CodeChunker`
   - Add `noAstChunking?: boolean` and `contextMode?: 'none' | 'minimal' | 'full'` to
     `BuildOptions`
   - Modify `_chunkSource()` to:
     - Use `CodeChunker` for supported files (unless `noAstChunking` is true)
     - Fall back to `Chunker` for unsupported files
   - Modify `_generateEmbeddings()` to use `chunk.embeddingContent ?? chunk.content`
2. Update `chunking.strategy` in metadata to indicate AST chunking was used

---

### T-05 — Update `VectorStore` schema

**Goal:** Add `embedding_content` column to store contextualizedText.

**Step-by-step instructions:**

1. Update `packages/core/src/store.ts`:
   - Add `embedding_content TEXT` column to chunks table
   - Update `addChunk()` and `addChunks()` to store `embeddingContent`
   - Update `StoredChunk` type to include `embeddingContent`
   - Update retrieval methods to return `embeddingContent`
2. Handle backward compatibility: if `embedding_content` is NULL, fall back to `content`

---

### T-06 — Add build options for AST chunking

**Goal:** Allow users to control AST chunking behavior.

**Step-by-step instructions:**

1. Add to `BuildOptions` in `packages/core/src/builder.ts`:
   ```typescript
   /** Disable AST-aware chunking for code files (default: false) */
   noAstChunking?: boolean;
   /** Context mode for AST chunking (default: 'full') */
   contextMode?: 'none' | 'minimal' | 'full';
   ```
2. Pass options through to `CodeChunker`

---

### T-07 — Update CLI with new options

**Goal:** Expose AST chunking options in the CLI.

**Step-by-step instructions:**

1. Update `packages/cli/src/commands/build.ts`:
   - Add `--no-ast-chunking` flag
   - Add `--context-mode <mode>` option with choices: `none`, `minimal`, `full`
2. Pass options to `Builder.build()`
3. Update CLI help text

---

### T-08 — Update MCP tools with new options

**Goal:** Expose AST chunking options in MCP build tool.

**Step-by-step instructions:**

1. Update `packages/mcp/src/tools/build.ts`:
   - Add `noAstChunking` and `contextMode` to tool parameters
2. Update `packages/mcp/src/tasks/build-worker.ts` to pass options

---

### T-09 — Write unit tests

**Goal:** Ensure new functionality is well-tested.

**Step-by-step instructions:**

1. Create `packages/core/src/__tests__/code-chunker.test.ts`:
   - Test `isSupported()` for various file extensions
   - Test `chunkText()` with TypeScript, Python, etc.
   - Test fallback behavior for unsupported files
   - Test error handling for malformed code
2. Update `packages/core/src/__tests__/builder.test.ts`:
   - Test build with AST chunking enabled
   - Test build with `noAstChunking: true`
   - Test `contextMode` options
   - Test mixed file types (code + markdown)

---

### T-10 — Update documentation

**Goal:** Document new features for users.

**Step-by-step instructions:**

1. Update `packages/core/README.md`:
   - Document `CodeChunker` class
   - Document new `BuildOptions`
2. Update `packages/cli/README.md`:
   - Document `--no-ast-chunking` and `--context-mode` flags
3. Update `packages/mcp/README.md`:
   - Document new build tool parameters
4. Update `packages/website/src/content/docs/building.md`:
   - Add section on AST-aware chunking
   - Explain benefits and when to use/disable

## New Code

### `packages/core/src/code-chunker.ts` (new file)

Creates a `CodeChunker` class that:

- Wraps the `code-chunk` library
- Provides `isSupported()`, `detectLanguage()`, `chunkText()`, `chunkFile()`,
  `chunkSourceFiles()` methods
- Maps code-chunk's `Chunk` type to libragen's `Chunk` type
- Handles errors gracefully

### `packages/core/src/chunker.ts` (modifications)

- Add `CodeContext` interface
- Add `codeContext?: CodeContext` to `ChunkMetadata`
- Add `embeddingContent?: string` to `Chunk`

### `packages/core/src/builder.ts` (modifications)

- Import `CodeChunker`
- Add `noAstChunking`, `contextMode` to `BuildOptions`
- Update `_chunkSource()` to use `CodeChunker` for supported files
- Update `_generateEmbeddings()` to use `embeddingContent`
- Update metadata to reflect chunking strategy

### `packages/core/src/store.ts` (modifications)

- Add `embedding_content` column
- Update insert/retrieve methods
- Handle backward compatibility

### `packages/cli/src/commands/build.ts` (modifications)

- Add `--no-ast-chunking` flag
- Add `--context-mode` option

### `packages/mcp/src/tools/build.ts` (modifications)

- Add `noAstChunking`, `contextMode` parameters

## Tests

1. **`code-chunker.test.ts`**:
   - `isSupported()` returns true for `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rs`, `.go`,
     `.java`
   - `isSupported()` returns false for `.md`, `.json`, `.txt`, etc.
   - `chunkText()` produces chunks with semantic context for TypeScript code
   - `chunkText()` handles parse errors gracefully
   - `chunkSourceFiles()` processes multiple files correctly

2. **`builder.test.ts` (additions)**:
   - Build with AST chunking produces chunks with `codeContext`
   - Build with `noAstChunking: true` produces chunks without `codeContext`
   - `contextMode` option is respected
   - Mixed file types (code + markdown) are handled correctly

3. **Integration tests**:
   - Build a library from a TypeScript project
   - Verify chunks have semantic context
   - Verify search quality improvement (manual verification)

## Review Checklist

- [x] Have all outstanding questions been answered?
- [x] Are there any ambiguities that need to be resolved?
