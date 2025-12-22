/**
 * Build command - Creates a .libragen library from source files
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import {
   Builder,
   formatBytes,
   formatDuration,
   isGitUrl,
   parseGitUrl,
   estimateEmbeddingTime,
   formatSystemInfo,
} from '@libragen/core';
import type { BuildProgress } from '@libragen/core';
import { BaseCommand } from '../base-command.ts';

export default class Build extends BaseCommand {
   public static override summary = 'Build a .libragen library from source files';

   public static override description = `Creates a searchable RAG library from documentation, code, or other text files.
Supports local directories, single files, and git repositories (public or private).`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %> ./docs',
      '<%= config.bin %> <%= command.id %> ./docs --name my-docs --description "My documentation"',
      '<%= config.bin %> <%= command.id %> https://github.com/org/repo',
      '<%= config.bin %> <%= command.id %> https://github.com/org/repo --git-ref v1.0.0',
   ];

   public static override args = {
      source: Args.string({
         description: 'Source directory, file, or git URL to index',
         required: true,
      }),
   };

   public static override flags = {
      output: Flags.string({
         char: 'o',
         description: 'Output path for the .libragen file',
      }),
      name: Flags.string({
         char: 'n',
         description: 'Library name (defaults to directory name)',
      }),
      version: Flags.string({
         char: 'v',
         description: 'Library version',
         default: '0.1.0',
      }),
      'content-version': Flags.string({
         description: 'Version of the source content',
      }),
      description: Flags.string({
         char: 'd',
         description: 'Short description of the library',
      }),
      'agent-description': Flags.string({
         description: 'Guidance for AI agents on when to use this library',
      }),
      'example-queries': Flags.string({
         description: 'Example queries this library can answer',
         multiple: true,
      }),
      keywords: Flags.string({
         description: 'Searchable keywords/tags',
         multiple: true,
      }),
      'programming-languages': Flags.string({
         description: 'Programming languages covered (e.g., typescript python)',
         multiple: true,
      }),
      'text-languages': Flags.string({
         description: 'Human/natural languages as ISO 639-1 codes (e.g., en es zh)',
         multiple: true,
      }),
      frameworks: Flags.string({
         description: 'Frameworks covered (e.g., react express)',
         multiple: true,
      }),
      'chunk-size': Flags.string({
         description: 'Target chunk size in characters',
         default: '1000',
      }),
      'chunk-overlap': Flags.string({
         description: 'Chunk overlap in characters',
         default: '100',
      }),
      include: Flags.string({
         char: 'i',
         description: 'Glob patterns to include',
         multiple: true,
      }),
      exclude: Flags.string({
         char: 'e',
         description: 'Glob patterns to exclude (added to defaults)',
         multiple: true,
      }),
      'default-excludes': Flags.boolean({
         description: 'Use default exclusions (node_modules, .git, dist, etc.)',
         default: true,
         allowNo: true,
      }),
      'git-ref': Flags.string({
         description: 'Git branch, tag, or commit to checkout (remote git sources only)',
      }),
      'git-repo-auth-token': Flags.string({
         description: 'Auth token for private git repositories',
      }),
      license: Flags.string({
         description: 'SPDX license identifier(s) for the source content',
         multiple: true,
      }),
      'ast-chunking': Flags.boolean({
         description: 'Use AST-aware chunking for code files',
         default: true,
         allowNo: true,
      }),
      'context-mode': Flags.string({
         description: 'Context mode for AST chunking: none, minimal, or full',
         default: 'full',
         options: [ 'none', 'minimal', 'full' ],
      }),
   };

   public static override aliases = [ 'b' ];

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(Build);

      const spinner = this.createSpinner();

      try {
         const isGit = isGitUrl(args.source);

         if (isGit) {
            const parsed = parseGitUrl(args.source);

            console.log(chalk.bold('\n📚 Building libragen library from git\n'));
            console.log(`  Repository: ${chalk.cyan(parsed.repoUrl)}`);
            if (flags['git-ref'] || parsed.ref) {
               console.log(`  Ref:        ${chalk.cyan(flags['git-ref'] || parsed.ref)}`);
            }
            if (parsed.path) {
               console.log(`  Path:       ${chalk.cyan(parsed.path)}`);
            }
            console.log('');
         } else {
            console.log(chalk.bold('\n📚 Building libragen library\n'));
            console.log(`  Source:  ${chalk.cyan(args.source)}`);
         }

         let estimateShown = false;

         const handleBuildProgress = (progress: BuildProgress): void => {
            switch (progress.phase) {
               case 'cloning': {
                  spinner.start(progress.message);
                  break;
               }
               case 'loading-model': {
                  spinner.start(progress.message);
                  break;
               }
               case 'chunking': {
                  if (spinner.isSpinning) {
                     spinner.succeed();
                  }
                  spinner.start(progress.message);
                  break;
               }
               case 'embedding': {
                  if (!estimateShown && progress.total) {
                     if (spinner.isSpinning) {
                        spinner.succeed();
                     }
                     const estimate = estimateEmbeddingTime(progress.total);

                     const estMsg = `${chalk.yellow(estimate.formattedTime)} ` +
                        `(~${Math.round(estimate.chunksPerSecond)} chunks/sec)`;

                     console.log('');
                     console.log(`  ${chalk.dim('System:')}      ${formatSystemInfo(estimate.systemInfo)}`);
                     console.log(`  ${chalk.dim('Est. time:')}   ${estMsg}`);
                     console.log('');
                     estimateShown = true;
                  }
                  spinner.start(progress.message);
                  break;
               }
               case 'creating-database': {
                  if (spinner.isSpinning) {
                     spinner.succeed();
                  }
                  spinner.start(progress.message);
                  break;
               }
               case 'complete': {
                  if (spinner.isSpinning) {
                     spinner.succeed();
                  }
                  break;
               }
               default: {
                  spinner.start(progress.message);
               }
            }
         };

         const builder = new Builder();

         const buildOptions = {
            output: flags.output,
            name: flags.name,
            version: flags.version,
            contentVersion: flags['content-version'],
            description: flags.description,
            agentDescription: flags['agent-description'],
            exampleQueries: flags['example-queries'],
            keywords: flags.keywords,
            programmingLanguages: flags['programming-languages'],
            textLanguages: flags['text-languages'],
            frameworks: flags.frameworks,
            chunkSize: flags['chunk-size'] ? parseInt(flags['chunk-size'], 10) : undefined,
            chunkOverlap: flags['chunk-overlap'] ? parseInt(flags['chunk-overlap'], 10) : undefined,
            include: flags.include,
            exclude: flags.exclude,
            noDefaultExcludes: !flags['default-excludes'],
            gitRef: flags['git-ref'],
            gitRepoAuthToken: flags['git-repo-auth-token'],
            license: flags.license,
            noAstChunking: !flags['ast-chunking'],
            contextMode: flags['context-mode'] as 'none' | 'minimal' | 'full' | undefined,
         };

         const result = await builder.build(args.source, buildOptions, handleBuildProgress);

         if (result.git) {
            spinner.info(`Commit: ${result.git.commitHash.slice(0, 8)}`);
            if (result.git.detectedLicense) {
               const licenseMsg = `Detected license: ${result.git.detectedLicense.identifier} ` +
                  `(${result.git.detectedLicense.confidence} confidence)`;

               spinner.info(licenseMsg);
            }
         }

         console.log(chalk.bold.green('\n✅ Library built successfully!\n'));
         console.log(`  ${chalk.dim('File:')}        ${result.outputPath}`);
         console.log(`  ${chalk.dim('Size:')}        ${formatBytes(result.stats.fileSize)}`);
         console.log(`  ${chalk.dim('Chunks:')}      ${result.stats.chunkCount}`);
         console.log(`  ${chalk.dim('Sources:')}     ${result.stats.sourceCount} files`);
         const embedMsg = `${formatDuration(result.stats.embedDuration)} ` +
            `(~${result.stats.chunksPerSecond} chunks/sec)`;

         console.log(`  ${chalk.dim('Embed time:')}  ${embedMsg}`);
         if (result.metadata.source?.licenses?.length) {
            console.log(`  ${chalk.dim('License:')}     ${result.metadata.source.licenses.join(', ')}`);
         }
         console.log(`  ${chalk.dim('Hash:')}        ${result.metadata.contentHash.replace('sha256:', '').slice(0, 16)}...`);
         console.log('');
      } catch(error) {
         spinner.fail('Build failed');
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
