/**
 * Query command - Search a .libragen library
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import { Embedder, VectorStore, Searcher, LibraryManager } from '@libragen/core';
import { BaseCommand } from '../base-command.ts';

export default class Query extends BaseCommand {
   public static override summary = 'Search a .libragen library';

   public static override description = `Search for relevant content in a libragen library using semantic search.
Supports both library names (resolved from installed libraries) and direct file paths.`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %> "how to configure routing" -l next.js',
      '<%= config.bin %> <%= command.id %> "authentication" -l ./my-docs.libragen',
      '<%= config.bin %> <%= command.id %> "error handling" -l express -k 10 --json',
   ];

   public static override args = {
      query: Args.string({
         description: 'Search query',
         required: true,
      }),
   };

   public static override flags = {
      library: Flags.string({
         char: 'l',
         description: 'Library name or path to .libragen file',
         required: true,
      }),
      path: Flags.string({
         char: 'p',
         description: 'Project directory (will search <path>/.libragen/libraries)',
         multiple: true,
      }),
      k: Flags.integer({
         char: 'k',
         description: 'Number of results to return',
         default: 5,
      }),
      'hybrid-alpha': Flags.string({
         description: 'Balance between vector (1) and keyword (0) search',
         default: '0.5',
      }),
      'content-version': Flags.string({
         description: 'Filter by content version',
      }),
      'context-before': Flags.integer({
         description: 'Number of chunks to include before each result',
      }),
      'context-after': Flags.integer({
         description: 'Number of chunks to include after each result',
      }),
      json: Flags.boolean({
         description: 'Output results as JSON',
         default: false,
      }),
   };

   public static override aliases = [ 'q' ];

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(Query);

      const spinner = this.createSpinner();

      try {
         const libraryPath = await this.resolveLibraryPath(
            flags.library,
            flags.path,
            spinner,
            flags.json
         );

         if (!flags.json) {
            spinner.start('Loading embedding model...');
         }

         const embedder = new Embedder();

         await embedder.initialize();

         if (!flags.json) {
            spinner.succeed('Embedding model loaded');
         }

         const store = new VectorStore(libraryPath);

         store.initialize();

         const searcher = new Searcher(embedder, store),
               hybridAlpha = parseFloat(flags['hybrid-alpha']);

         if (!flags.json) {
            spinner.start('Searching...');
         }

         const results = await searcher.search({
            query: args.query,
            k: flags.k,
            hybridAlpha,
            contentVersion: flags['content-version'],
            contextBefore: flags['context-before'],
            contextAfter: flags['context-after'],
         });

         if (!flags.json) {
            spinner.stop();
         }

         if (flags.json) {
            console.log(JSON.stringify(results, null, 2));
         } else {
            this.printResults(results);
         }

         store.close();
         await embedder.dispose();
      } catch(error) {
         spinner.fail('Query failed');
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }

   private isFilePath(value: string): boolean {
      return value.includes('/') || value.includes('\\') || value.endsWith('.libragen');
   }

   private async resolveLibraryPath(
      library: string,
      paths: string[] | undefined,
      spinner: ReturnType<typeof import('ora').default>,
      isJson: boolean
   ): Promise<string> {
      if (this.isFilePath(library)) {
         const libraryPath = path.resolve(library);

         try {
            await fs.access(libraryPath);
         } catch(_e) {
            console.error(chalk.red(`Error: Library not found: ${libraryPath}`));
            process.exit(1);
         }

         return libraryPath;
      }

      if (!isJson) {
         spinner.start(`Resolving library '${library}'...`);
      }

      const transformedPaths = this.transformPaths(paths);

      const manager = new LibraryManager(transformedPaths ? { paths: transformedPaths } : undefined);

      const installed = await manager.find(library);

      if (!installed) {
         if (!isJson) {
            spinner.fail(`Library '${library}' not found`);
         }
         console.error(chalk.red(`\nError: Library '${library}' is not installed.`));
         console.error(chalk.dim('Use `libragen list` to see installed libraries.'));
         process.exit(1);
      }

      if (!isJson) {
         spinner.succeed(`Found library at ${chalk.dim(installed.path)}`);
      }

      return installed.path;
   }

   private printResults(results: Awaited<ReturnType<Searcher['search']>>): void {
      if (results.length === 0) {
         console.log(chalk.yellow('\nNo results found.'));
         return;
      }

      console.log(chalk.bold(`\n📚 Found ${results.length} results:\n`));

      for (const [ index, result ] of results.entries()) {
         this.printSingleResult(result, index);
      }
   }

   private printSingleResult(
      result: Awaited<ReturnType<Searcher['search']>>[number],
      index: number
   ): void {
      const sourceInfo = result.sourceFile
         ? chalk.dim(path.basename(result.sourceFile))
         : chalk.dim('unknown source');

      const lineInfo = result.startLine ? chalk.dim(`:${result.startLine}`) : '';

      console.log(chalk.bold.cyan(`${index + 1}. ${sourceInfo}${lineInfo}`));
      console.log(chalk.dim(`   Score: ${result.score.toFixed(4)}`));

      if (result.contentVersion) {
         console.log(chalk.dim(`   Version: ${result.contentVersion}`));
      }

      console.log('');

      this.printContextBefore(result);
      this.printMainContent(result);
      this.printContextAfter(result);

      console.log('');
   }

   private printContextBefore(result: Awaited<ReturnType<Searcher['search']>>[number]): void {
      if (!result.contextBefore || result.contextBefore.length === 0) {
         return;
      }

      for (const chunk of result.contextBefore) {
         const ctxLine = chunk.startLine ? `:${chunk.startLine}` : '';

         console.log(chalk.dim(`   [context${ctxLine}]`));
         console.log(chalk.dim(`   ${chunk.content.trim().split('\n').join('\n   ')}`));
         console.log('');
      }
      console.log(chalk.dim('   --- match ---'));
      console.log('');
   }

   private printMainContent(result: Awaited<ReturnType<Searcher['search']>>[number]): void {
      const content = result.content.trim();

      console.log(`   ${content.split('\n').join('\n   ')}`);
   }

   private printContextAfter(result: Awaited<ReturnType<Searcher['search']>>[number]): void {
      if (!result.contextAfter || result.contextAfter.length === 0) {
         return;
      }

      console.log('');
      console.log(chalk.dim('   --- match ---'));

      for (const chunk of result.contextAfter) {
         const ctxLine = chunk.startLine ? `:${chunk.startLine}` : '';

         console.log('');
         console.log(chalk.dim(`   [context${ctxLine}]`));
         console.log(chalk.dim(`   ${chunk.content.trim().split('\n').join('\n   ')}`));
      }
   }
}
