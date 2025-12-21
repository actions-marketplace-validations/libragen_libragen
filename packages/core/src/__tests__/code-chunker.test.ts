import { describe, it, expect, beforeEach } from 'vitest';
import { CodeChunker } from '../code-chunker.js';

describe('CodeChunker', () => {
   let chunker: CodeChunker;

   beforeEach(() => {
      chunker = new CodeChunker();
   });

   describe('constructor', () => {
      it('uses default configuration when none provided', () => {
         const c = new CodeChunker();

         expect(c.maxChunkSize).toBe(1500);
         expect(c.contextMode).toBe('full');
         expect(c.overlapLines).toBe(0);
      });

      it('accepts custom configuration', () => {
         const c = new CodeChunker({
            maxChunkSize: 1000,
            contextMode: 'minimal',
            overlapLines: 2,
         });

         expect(c.maxChunkSize).toBe(1000);
         expect(c.contextMode).toBe('minimal');
         expect(c.overlapLines).toBe(2);
      });
   });

   describe('isSupported', () => {
      it('returns true for TypeScript files', () => {
         expect(CodeChunker.isSupported('test.ts')).toBe(true);
         expect(CodeChunker.isSupported('test.tsx')).toBe(true);
         expect(CodeChunker.isSupported('test.mts')).toBe(true);
         expect(CodeChunker.isSupported('test.cts')).toBe(true);
      });

      it('returns true for JavaScript files', () => {
         expect(CodeChunker.isSupported('test.js')).toBe(true);
         expect(CodeChunker.isSupported('test.jsx')).toBe(true);
         expect(CodeChunker.isSupported('test.mjs')).toBe(true);
         expect(CodeChunker.isSupported('test.cjs')).toBe(true);
      });

      it('returns true for Python files', () => {
         expect(CodeChunker.isSupported('test.py')).toBe(true);
         expect(CodeChunker.isSupported('test.pyi')).toBe(true);
      });

      it('returns true for Rust files', () => {
         expect(CodeChunker.isSupported('test.rs')).toBe(true);
      });

      it('returns true for Go files', () => {
         expect(CodeChunker.isSupported('test.go')).toBe(true);
      });

      it('returns true for Java files', () => {
         expect(CodeChunker.isSupported('test.java')).toBe(true);
      });

      it('returns false for Markdown files', () => {
         expect(CodeChunker.isSupported('README.md')).toBe(false);
         expect(CodeChunker.isSupported('test.mdx')).toBe(false);
      });

      it('returns false for JSON files', () => {
         expect(CodeChunker.isSupported('test.json')).toBe(false);
      });

      it('returns false for text files', () => {
         expect(CodeChunker.isSupported('test.txt')).toBe(false);
      });

      it('returns false for unsupported files', () => {
         expect(CodeChunker.isSupported('test.bin')).toBe(false);
         expect(CodeChunker.isSupported('test.exe')).toBe(false);
         expect(CodeChunker.isSupported('test.jpg')).toBe(false);
      });

      it('is case-insensitive for extensions', () => {
         expect(CodeChunker.isSupported('test.TS')).toBe(true);
         expect(CodeChunker.isSupported('test.PY')).toBe(true);
      });
   });

   describe('detectLanguage', () => {
      it('detects TypeScript for .ts files', () => {
         expect(CodeChunker.detectLanguage('test.ts')).toBe('typescript');
         expect(CodeChunker.detectLanguage('test.tsx')).toBe('typescript');
      });

      it('detects JavaScript for .js files', () => {
         expect(CodeChunker.detectLanguage('test.js')).toBe('javascript');
         expect(CodeChunker.detectLanguage('test.jsx')).toBe('javascript');
      });

      it('detects Python for .py files', () => {
         expect(CodeChunker.detectLanguage('test.py')).toBe('python');
      });

      it('detects Rust for .rs files', () => {
         expect(CodeChunker.detectLanguage('test.rs')).toBe('rust');
      });

      it('detects Go for .go files', () => {
         expect(CodeChunker.detectLanguage('test.go')).toBe('go');
      });

      it('detects Java for .java files', () => {
         expect(CodeChunker.detectLanguage('test.java')).toBe('java');
      });

      it('returns null for unsupported files', () => {
         expect(CodeChunker.detectLanguage('test.md')).toBeNull();
         expect(CodeChunker.detectLanguage('test.txt')).toBeNull();
         expect(CodeChunker.detectLanguage('test.bin')).toBeNull();
      });
   });

   describe('getSupportedExtensions', () => {
      it('returns all supported extensions', () => {
         const extensions = CodeChunker.getSupportedExtensions();

         expect(extensions).toContain('.ts');
         expect(extensions).toContain('.tsx');
         expect(extensions).toContain('.js');
         expect(extensions).toContain('.jsx');
         expect(extensions).toContain('.py');
         expect(extensions).toContain('.rs');
         expect(extensions).toContain('.go');
         expect(extensions).toContain('.java');
      });
   });

   describe('chunkText', () => {
      it('chunks TypeScript code with semantic context', async () => {
         const tsCode = `
export function greet(name: string): string {
   return \`Hello, \${name}!\`;
}

export class Greeter {
   private name: string;

   constructor(name: string) {
      this.name = name;
   }

   greet(): string {
      return \`Hello, \${this.name}!\`;
   }
}
`;

         const chunks = await chunker.chunkText(tsCode, 'greeter.ts');

         expect(chunks.length).toBeGreaterThan(0);

         // All chunks should have metadata
         for (const chunk of chunks) {
            expect(chunk.metadata.sourceFile).toBe('greeter.ts');
            expect(chunk.metadata.language).toBe('typescript');
            expect(chunk.metadata.startLine).toBeDefined();
            expect(chunk.metadata.endLine).toBeDefined();
         }

         // At least one chunk should have semantic context
         const hasSemanticContext = chunks.some((c) => {
            return c.metadata.codeContext !== undefined;
         });

         expect(hasSemanticContext).toBe(true);

         // Chunks should have embeddingContent (contextualizedText)
         const hasEmbeddingContent = chunks.some((c) => {
            return c.embeddingContent !== undefined;
         });

         expect(hasEmbeddingContent).toBe(true);
      });

      it('chunks Python code with semantic context', async () => {
         const pyCode = `
def greet(name: str) -> str:
    """Greet a person by name."""
    return f"Hello, {name}!"

class Greeter:
    """A class that greets people."""

    def __init__(self, name: str):
        self.name = name

    def greet(self) -> str:
        return f"Hello, {self.name}!"
`;

         const chunks = await chunker.chunkText(pyCode, 'greeter.py');

         expect(chunks.length).toBeGreaterThan(0);

         for (const chunk of chunks) {
            expect(chunk.metadata.sourceFile).toBe('greeter.py');
            expect(chunk.metadata.language).toBe('python');
         }
      });

      it('throws for unsupported file types', async () => {
         await expect(chunker.chunkText('# Hello', 'README.md')).rejects.toThrow(
            'Unsupported file type for AST chunking'
         );
      });

      it('uses 1-indexed line numbers', async () => {
         const code = `function hello() {
   return 'world';
}`;

         const chunks = await chunker.chunkText(code, 'test.js');

         // Line numbers should be 1-indexed (not 0-indexed)
         expect(chunks[0].metadata.startLine).toBeGreaterThanOrEqual(1);
      });
   });

   describe('tryChunkText', () => {
      it('returns chunks for valid code', async () => {
         const code = 'const x = 1;';

         const chunks = await chunker.tryChunkText(code, 'test.js');

         expect(chunks).not.toBeNull();
         expect(chunks?.length).toBeGreaterThan(0);
      });

      it('returns null for unsupported file types', async () => {
         const chunks = await chunker.tryChunkText('# Hello', 'README.md');

         expect(chunks).toBeNull();
      });
   });

   describe('chunkSourceFiles', () => {
      const makeSourceFile = (relativePath: string, content: string): {
         path: string;
         relativePath: string;
         content: string;
         size: number;
         modifiedAt: Date;
      } => {
         return {
            path: `/test/${relativePath}`,
            relativePath,
            content,
            size: content.length,
            modifiedAt: new Date(),
         };
      };

      it('chunks multiple source files', async () => {
         const files = [
            makeSourceFile('a.ts', 'const a = 1;'),
            makeSourceFile('b.py', 'b = 2'),
         ];

         const chunks = await chunker.chunkSourceFiles(files);

         expect(chunks.length).toBeGreaterThanOrEqual(2);

         const sourceFiles = chunks.map((c) => {
            return c.metadata.sourceFile;
         });

         expect(sourceFiles).toContain('a.ts');
         expect(sourceFiles).toContain('b.py');
      });

      it('skips unsupported files', async () => {
         const files = [
            makeSourceFile('code.ts', 'const x = 1;'),
            makeSourceFile('readme.md', '# Hello'),
         ];

         const chunks = await chunker.chunkSourceFiles(files);

         // Should only have chunks from the TypeScript file
         const sourceFiles = new Set(chunks.map((c) => {
            return c.metadata.sourceFile;
         }));

         expect(sourceFiles.has('code.ts')).toBe(true);
         expect(sourceFiles.has('readme.md')).toBe(false);
      });

      it('returns empty array for no supported files', async () => {
         const files = [
            makeSourceFile('readme.md', '# Hello'),
            makeSourceFile('data.json', '{}'),
         ];

         const chunks = await chunker.chunkSourceFiles(files);

         expect(chunks).toEqual([]);
      });
   });

   describe('semantic context', () => {
      it('includes scope chain for nested code', async () => {
         const code = `
class Calculator {
   add(a: number, b: number): number {
      return a + b;
   }
}
`;

         const chunks = await chunker.chunkText(code, 'calc.ts');

         // Find a chunk that contains the add method
         const methodChunk = chunks.find((c) => {
            return c.content.includes('add');
         });

         expect(methodChunk).toBeDefined();

         // The method should have scope context showing it's inside Calculator
         if (methodChunk?.metadata.codeContext) {
            const { scope, entities } = methodChunk.metadata.codeContext;

            // Either scope or entities should reference Calculator or add
            const hasClassContext = scope.some((s) => {
               return s.name === 'Calculator';
            }) || entities.some((e) => {
               return e.name === 'Calculator' || e.name === 'add';
            });

            expect(hasClassContext).toBe(true);
         }
      });

      it('includes import information', async () => {
         const code = `
import { readFile } from 'fs/promises';
import path from 'path';

export async function loadConfig(file: string) {
   const content = await readFile(path.resolve(file), 'utf-8');
   return JSON.parse(content);
}
`;

         const chunks = await chunker.chunkText(code, 'config.ts');

         // At least one chunk should have import context
         const hasImports = chunks.some((c) => {
            return c.metadata.codeContext?.imports && c.metadata.codeContext.imports.length > 0;
         });

         expect(hasImports).toBe(true);
      });
   });
});
