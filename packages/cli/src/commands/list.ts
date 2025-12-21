/**
 * List command - List installed libraries and collections
 */

/* eslint-disable no-console, no-process-exit */

import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { LibraryManager, formatBytes } from '@libragen/core';
import type { InstalledLibrary, InstalledCollection } from '@libragen/core';
import { BaseCommand } from '../base-command.ts';

export default class List extends BaseCommand {
   public static override summary = 'List installed libraries and collections';

   public static override description = `Display all installed libragen libraries and collections.
Shows library metadata including version, description, and location.`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %>',
      '<%= config.bin %> <%= command.id %> --verbose',
      '<%= config.bin %> <%= command.id %> --json',
      '<%= config.bin %> <%= command.id %> --libraries',
   ];

   public static override flags = {
      json: Flags.boolean({
         description: 'Output as JSON',
         default: false,
      }),
      verbose: Flags.boolean({
         char: 'v',
         description: 'Show detailed information',
         default: false,
      }),
      'show-path': Flags.boolean({
         description: 'Show the file path for each library',
         default: false,
      }),
      path: Flags.string({
         char: 'p',
         description: 'Project directory (will search <path>/.libragen/libraries)',
         multiple: true,
      }),
      libraries: Flags.boolean({
         description: 'Show only libraries',
         default: false,
      }),
      collections: Flags.boolean({
         description: 'Show only collections',
         default: false,
      }),
   };

   public static override aliases = [ 'l', 'ls' ];

   public async run(): Promise<void> {
      const { flags } = await this.parse(List);

      try {
         const transformedPaths = this.transformPaths(flags.path);

         const managerOptions = transformedPaths ? { paths: transformedPaths } : undefined;

         const manager = new LibraryManager(managerOptions);

         const showLibraries = !flags.collections || flags.libraries,
               showCollections = !flags.libraries || flags.collections;

         const libraries = showLibraries ? await manager.listInstalled() : [],
               collections = showCollections ? await manager.listCollections() : [];

         if (flags.json) {
            console.log(JSON.stringify({ libraries, collections }, null, 2));
            return;
         }

         const hasContent = libraries.length > 0 || collections.length > 0;

         if (!hasContent) {
            this.printEmptyMessage();
            return;
         }

         if (showCollections && collections.length > 0) {
            this.printCollections(collections, flags.verbose);
         }

         if (showLibraries && libraries.length > 0) {
            this.printLibraries(libraries, flags.verbose, flags['show-path']);
         }
      } catch(error) {
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }

   private printEmptyMessage(): void {
      console.log(chalk.yellow('\nNo libraries or collections installed.\n'));
      console.log('Install libraries with:');
      console.log(chalk.cyan('  libragen install <file.libragen>'));
      console.log('');
      console.log('Install collections with:');
      console.log(chalk.cyan('  libragen install <collection.json>'));
      console.log('');
      console.log('Or build a library with:');
      console.log(chalk.cyan('  libragen build <source>'));
      console.log('');
   }

   private printCollections(collections: InstalledCollection[], verbose: boolean): void {
      console.log(chalk.bold(`\n📦 Installed Collections (${collections.length})\n`));

      for (const col of collections) {
         console.log(`  ${chalk.bold(col.name)} ${col.version ? chalk.dim(`v${col.version}`) : ''}`);
         console.log(`    ${chalk.dim('Libraries:')} ${col.libraries.length}`);

         if (verbose) {
            this.printCollectionDetails(col);
         }

         console.log('');
      }
   }

   private printCollectionDetails(col: InstalledCollection): void {
      console.log(`    ${chalk.dim('Source:')} ${col.source}`);
      console.log(`    ${chalk.dim('Installed:')} ${col.installedAt}`);

      if (col.libraries.length > 0) {
         console.log(`    ${chalk.dim('Includes:')} ${col.libraries.join(', ')}`);
      }
   }

   private printLibraries(libraries: InstalledLibrary[], verbose: boolean, showPath: boolean): void {
      console.log(chalk.bold(`\n📚 Installed Libraries (${libraries.length})\n`));

      for (const lib of libraries) {
         const locationBadge = lib.location === 'project'
            ? chalk.blue('[project]')
            : chalk.dim('[global]');

         console.log(`  ${chalk.bold(lib.name)} ${chalk.dim(`v${lib.version}`)} ${locationBadge}`);

         if (showPath) {
            console.log(`    ${chalk.dim(lib.path)}`);
         }

         if (lib.contentVersion) {
            console.log(`    ${chalk.dim('Content:')} ${lib.contentVersion}`);
         }

         if (lib.description) {
            console.log(`    ${chalk.dim(lib.description)}`);
         }

         if (verbose) {
            this.printLibraryDetails(lib);
         }

         console.log('');
      }
   }

   private printLibraryDetails(lib: InstalledLibrary): void {
      console.log(`    ${chalk.dim('Path:')} ${lib.path}`);
      console.log(`    ${chalk.dim('Chunks:')} ${lib.metadata.stats.chunkCount}`);
      console.log(`    ${chalk.dim('Size:')} ${formatBytes(lib.metadata.stats.fileSize)}`);

      if (lib.metadata.keywords?.length) {
         console.log(`    ${chalk.dim('Keywords:')} ${lib.metadata.keywords.join(', ')}`);
      }

      if (lib.metadata.programmingLanguages?.length) {
         console.log(`    ${chalk.dim('Programming Languages:')} ${lib.metadata.programmingLanguages.join(', ')}`);
      }

      if (lib.metadata.textLanguages?.length) {
         console.log(`    ${chalk.dim('Text Languages:')} ${lib.metadata.textLanguages.join(', ')}`);
      }
   }
}
