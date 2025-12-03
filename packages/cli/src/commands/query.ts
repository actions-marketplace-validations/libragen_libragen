/**
 * Query command - Search a .libragen library
 */

/* eslint-disable no-console, no-process-exit */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import ora from 'ora';
import chalk from 'chalk';
import { Embedder, VectorStore, Searcher, LibraryManager } from '@libragen/core';

interface QueryOptions {
   library: string;
   path?: string[];
   k?: string;
   hybridAlpha?: string;
   json?: boolean;
   contentVersion?: string;
   contextBefore?: string;
   contextAfter?: string;
}

/**
 * Determine if a value looks like a file path vs a library name.
 * A path contains path separators or ends with .libragen.
 */
function isFilePath(value: string): boolean {
   return value.includes('/') || value.includes('\\') || value.endsWith('.libragen');
}

export const queryCommand = new Command('query')
   .alias('q')
   .description('Search a .libragen library')
   .argument('<query>', 'Search query')
   .requiredOption('-l, --library <name-or-path>', 'Library name or path to .libragen file')
   .option('-p, --path <paths...>', 'Library path(s) to use for name resolution (excludes global and auto-detection)')
   .option('-k <number>', 'Number of results to return', '5')
   .option('--hybrid-alpha <number>', 'Balance between vector (1) and keyword (0) search', '0.5')
   .option('--content-version <version>', 'Filter by content version')
   .option('--context-before <n>', 'Number of chunks to include before each result')
   .option('--context-after <n>', 'Number of chunks to include after each result')
   .option('--json', 'Output results as JSON')
   .action(async (query: string, options: QueryOptions) => {
      const spinner = ora();

      try {
         let libraryPath: string;

         if (isFilePath(options.library)) {
            // Treat as a file path
            libraryPath = path.resolve(options.library);

            try {
               await fs.access(libraryPath);
            } catch(_e) {
               console.error(chalk.red(`Error: Library not found: ${libraryPath}`));
               process.exit(1);
            }
         } else {
            // Treat as a library name - use LibraryManager to resolve
            if (!options.json) {
               spinner.start(`Resolving library '${options.library}'...`);
            }

            const manager = new LibraryManager(
               options.path ? { paths: options.path } : undefined
            );

            const installed = await manager.find(options.library);

            if (!installed) {
               if (!options.json) {
                  spinner.fail(`Library '${options.library}' not found`);
               }
               console.error(chalk.red(`\nError: Library '${options.library}' is not installed.`));
               console.error(chalk.dim('Use `libragen list` to see installed libraries.'));
               process.exit(1);
            }

            libraryPath = installed.path;

            if (!options.json) {
               spinner.succeed(`Found library at ${chalk.dim(libraryPath)}`);
            }
         }

         if (!options.json) {
            spinner.start('Loading embedding model...');
         }

         // Initialize components
         const embedder = new Embedder();

         await embedder.initialize();

         if (!options.json) {
            spinner.succeed('Embedding model loaded');
         }

         const store = new VectorStore(libraryPath);

         store.initialize();

         const searcher = new Searcher(embedder, store);

         // Parse options
         const k = parseInt(options.k || '5', 10),
               hybridAlpha = parseFloat(options.hybridAlpha || '0.5'),
               contextBefore = options.contextBefore ? parseInt(options.contextBefore, 10) : undefined,
               contextAfter = options.contextAfter ? parseInt(options.contextAfter, 10) : undefined;

         if (!options.json) {
            spinner.start('Searching...');
         }

         // Perform search
         const results = await searcher.search({
            query,
            k,
            hybridAlpha,
            contentVersion: options.contentVersion,
            contextBefore,
            contextAfter,
         });

         if (!options.json) {
            spinner.stop();
         }

         // Output results
         if (options.json) {
            console.log(JSON.stringify(results, null, 2));
         } else {
            if (results.length === 0) {
               console.log(chalk.yellow('\nNo results found.'));
            }

            if (results.length > 0) {
               console.log(chalk.bold(`\n📚 Found ${results.length} results:\n`));

               const hasContext = contextBefore || contextAfter;

               results.forEach((result, index) => {
                  const sourceInfo = result.sourceFile
                     ? chalk.dim(path.basename(result.sourceFile))
                     : chalk.dim('unknown source');

                  const lineInfo = result.startLine
                     ? chalk.dim(`:${result.startLine}`)
                     : '';

                  console.log(chalk.bold.cyan(`${index + 1}. ${sourceInfo}${lineInfo}`));
                  console.log(chalk.dim(`   Score: ${result.score.toFixed(4)}`));

                  if (result.contentVersion) {
                     console.log(chalk.dim(`   Version: ${result.contentVersion}`));
                  }

                  console.log('');

                  // Show context before
                  if (result.contextBefore && result.contextBefore.length > 0) {
                     for (const chunk of result.contextBefore) {
                        const ctxLine = chunk.startLine ? `:${chunk.startLine}` : '';

                        console.log(chalk.dim(`   [context${ctxLine}]`));
                        console.log(chalk.dim(`   ${chunk.content.trim().split('\n').join('\n   ')}`));
                        console.log('');
                     }
                     console.log(chalk.dim('   --- match ---'));
                     console.log('');
                  }

                  // Show main content (full if context requested, truncated otherwise)
                  const content = result.content.trim();

                  if (hasContext) {
                     console.log(`   ${content.split('\n').join('\n   ')}`);
                  } else {
                     const maxLength = 200;

                     const truncated = content.length > maxLength
                        ? content.slice(0, maxLength) + '...'
                        : content;

                     console.log(`   ${truncated.split('\n').join('\n   ')}`);
                  }

                  // Show context after
                  if (result.contextAfter && result.contextAfter.length > 0) {
                     console.log('');
                     console.log(chalk.dim('   --- match ---'));
                     for (const chunk of result.contextAfter) {
                        const ctxLine = chunk.startLine ? `:${chunk.startLine}` : '';

                        console.log('');
                        console.log(chalk.dim(`   [context${ctxLine}]`));
                        console.log(chalk.dim(`   ${chunk.content.trim().split('\n').join('\n   ')}`));
                     }
                  }

                  console.log('');
               });
            }
         }

         // Cleanup
         store.close();
         await embedder.dispose();
      } catch(error) {
         spinner.fail('Query failed');
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   });
