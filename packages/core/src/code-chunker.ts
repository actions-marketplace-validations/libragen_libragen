/**
 * AST-aware code chunking using tree-sitter via the code-chunk library.
 *
 * Provides semantic chunking for code files that respects language boundaries
 * (functions, classes, methods) and includes rich context (scope chains, imports,
 * siblings, entity signatures) for better embedding quality.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
   chunk as codeChunk,
   type Chunk as CodeChunkChunk,
   type ChunkOptions as CodeChunkOptions,
   type Language as CodeChunkLanguage,
} from 'code-chunk';
import type { Chunk, ChunkMetadata, CodeContext } from './chunker.ts';
import type { SourceFile } from './sources/files.ts';

/**
 * Supported languages for AST-aware chunking.
 */
export type CodeChunkerLanguage = 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java';

/**
 * Context mode for AST chunking.
 */
export type ContextMode = 'none' | 'minimal' | 'full';

/**
 * Configuration for the CodeChunker.
 */
export interface CodeChunkerConfig {
   maxChunkSize?: number;
   contextMode?: ContextMode;
   overlapLines?: number;
}

/**
 * Map of file extensions to code-chunk supported languages.
 */
const EXTENSION_TO_LANGUAGE: Record<string, CodeChunkerLanguage> = {
   '.ts': 'typescript',
   '.tsx': 'typescript',
   '.mts': 'typescript',
   '.cts': 'typescript',
   '.js': 'javascript',
   '.jsx': 'javascript',
   '.mjs': 'javascript',
   '.cjs': 'javascript',
   '.py': 'python',
   '.pyi': 'python',
   '.rs': 'rust',
   '.go': 'go',
   '.java': 'java',
};

const DEFAULT_MAX_CHUNK_SIZE = 1500,
      DEFAULT_CONTEXT_MODE: ContextMode = 'full',
      DEFAULT_OVERLAP_LINES = 0;

/**
 * AST-aware code chunker using tree-sitter.
 *
 * This class wraps the code-chunk library to provide semantic chunking for code files.
 * It respects language boundaries (functions, classes, methods) and includes rich
 * context for better embedding quality.
 *
 * @example
 * ```typescript
 * const chunker = new CodeChunker();
 * const chunks = await chunker.chunkText(tsCode, 'src/utils.ts');
 * // chunks have semantic context: scope, entities, imports, siblings
 * ```
 */
export class CodeChunker {

   private readonly _config: Required<CodeChunkerConfig>;

   public constructor(config: CodeChunkerConfig = {}) {
      this._config = {
         maxChunkSize: config.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE,
         contextMode: config.contextMode ?? DEFAULT_CONTEXT_MODE,
         overlapLines: config.overlapLines ?? DEFAULT_OVERLAP_LINES,
      };
   }

   /**
    * Check if a file extension is supported for AST-aware chunking.
    */
   public static isSupported(filePath: string): boolean {
      const ext = path.extname(filePath).toLowerCase();

      return ext in EXTENSION_TO_LANGUAGE;
   }

   /**
    * Get the detected language for a file.
    */
   public static detectLanguage(filePath: string): CodeChunkerLanguage | null {
      const ext = path.extname(filePath).toLowerCase();

      return EXTENSION_TO_LANGUAGE[ext] ?? null;
   }

   /**
    * Get the list of supported file extensions.
    */
   public static getSupportedExtensions(): string[] {
      return Object.keys(EXTENSION_TO_LANGUAGE);
   }

   public get maxChunkSize(): number {
      return this._config.maxChunkSize;
   }

   public get contextMode(): ContextMode {
      return this._config.contextMode;
   }

   public get overlapLines(): number {
      return this._config.overlapLines;
   }

   /**
    * Chunk a single file's content using AST-aware chunking.
    *
    * @param content - The source code content
    * @param filePath - The file path (used for language detection)
    * @returns Array of chunks with semantic context
    */
   public async chunkText(content: string, filePath: string): Promise<Chunk[]> {
      const language = CodeChunker.detectLanguage(filePath);

      if (!language) {
         throw new Error(`Unsupported file type for AST chunking: ${filePath}`);
      }

      try {
         const options: CodeChunkOptions = {
            maxChunkSize: this._config.maxChunkSize,
            contextMode: this._config.contextMode,
            overlapLines: this._config.overlapLines,
            language: language as CodeChunkLanguage,
         };

         const codeChunks = await codeChunk(filePath, content, options);

         return codeChunks.map((chunk) => { return this._mapChunk(chunk, filePath, language); });
      } catch(error) {
         // If AST parsing fails, caller should fall back to text chunking
         const message = error instanceof Error ? error.message : String(error);

         throw new Error(`AST chunking failed for ${filePath}: ${message}`);
      }
   }

   /**
    * Chunk a file from the filesystem using AST-aware chunking.
    *
    * @param filePath - Path to the file
    * @returns Array of chunks with semantic context
    */
   public async chunkFile(filePath: string): Promise<Chunk[]> {
      const content = await fs.readFile(filePath, 'utf-8');

      return this.chunkText(content, filePath);
   }

   /**
    * Chunk an array of SourceFile objects using AST-aware chunking.
    * Files that fail to parse are skipped (no error thrown).
    *
    * @param files - Array of SourceFile objects to chunk
    * @returns Array of chunks from all successfully parsed files
    */
   public async chunkSourceFiles(files: SourceFile[]): Promise<Chunk[]> {
      const allChunks: Chunk[] = [];

      for (const file of files) {
         if (!CodeChunker.isSupported(file.relativePath)) {
            continue;
         }

         try {
            const chunks = await this.chunkText(file.content, file.relativePath);

            allChunks.push(...chunks);
         } catch(_e) {
            // Skip files that fail to parse - caller may want to fall back
            continue;
         }
      }

      return allChunks;
   }

   /**
    * Try to chunk text, returning null if AST parsing fails.
    * Useful for graceful fallback to text-based chunking.
    *
    * @param content - The source code content
    * @param filePath - The file path (used for language detection)
    * @returns Array of chunks, or null if parsing failed
    */
   public async tryChunkText(content: string, filePath: string): Promise<Chunk[] | null> {
      try {
         return await this.chunkText(content, filePath);
      } catch(_e) {
         return null;
      }
   }

   /**
    * Map a code-chunk Chunk to a libragen Chunk.
    */
   private _mapChunk(chunk: CodeChunkChunk, filePath: string, language: CodeChunkerLanguage): Chunk {
      const codeContext: CodeContext = {
         scope: chunk.context.scope.map((s) => {
            return {
               name: s.name,
               type: s.type,
               signature: s.signature,
            };
         }),
         entities: chunk.context.entities.map((e) => {
            return {
               name: e.name,
               type: e.type,
               signature: e.signature,
               docstring: e.docstring,
               lineRange: e.lineRange ? { start: e.lineRange.start, end: e.lineRange.end } : undefined,
               isPartial: e.isPartial,
            };
         }),
         siblings: chunk.context.siblings.map((s) => {
            return {
               name: s.name,
               type: s.type,
               position: s.position,
               distance: s.distance,
            };
         }),
         imports: chunk.context.imports.map((i) => {
            return {
               name: i.name,
               source: i.source,
               isDefault: i.isDefault,
               isNamespace: i.isNamespace,
            };
         }),
      };

      const metadata: ChunkMetadata = {
         sourceFile: filePath,
         startLine: chunk.lineRange.start + 1, // code-chunk uses 0-indexed, we use 1-indexed
         endLine: chunk.lineRange.end + 1,
         language,
         codeContext,
      };

      return {
         content: chunk.text,
         embeddingContent: chunk.contextualizedText,
         metadata,
      };
   }

}
