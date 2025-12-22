/**
 * Install command - Install a library or collection
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import { LibraryManager, CollectionClient } from '@libragen/core';
import { BaseCommand } from '../base-command.ts';

export default class Install extends BaseCommand {
   public static override summary = 'Install a library or collection';

   public static override description = `Install a libragen library from a local file, URL, or collection.
Supports .libragen files, collection .json files, and packed .libragen-collection archives.`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %> ./my-docs.libragen',
      '<%= config.bin %> <%= command.id %> https://example.com/library.libragen',
      '<%= config.bin %> <%= command.id %> ./collection.json',
      '<%= config.bin %> <%= command.id %> next.js',
   ];

   public static override args = {
      source: Args.string({
         description: 'Library file (.libragen), collection file (.json), or URL',
         required: true,
      }),
   };

   public static override flags = {
      path: Flags.string({
         char: 'p',
         description: 'Project directory (will install to <path>/.libragen/libraries)',
         multiple: true,
      }),
      force: Flags.boolean({
         char: 'f',
         description: 'Overwrite existing libraries',
         default: false,
      }),
      collection: Flags.string({
         char: 'c',
         description: 'Collection URL to search for library name',
      }),
      'content-version': Flags.string({
         description: 'Install specific content version',
      }),
      all: Flags.boolean({
         char: 'a',
         description: 'Install all libraries including optional (for collections)',
         default: false,
      }),
      select: Flags.boolean({
         char: 's',
         description: 'Interactively select optional libraries (for collections)',
         default: false,
      }),
   };

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(Install);

      const spinner = this.createSpinner();

      try {
         const transformedPaths = this.transformPaths(flags.path);

         const managerOptions = transformedPaths ? { paths: transformedPaths } : undefined;

         const manager = new LibraryManager(managerOptions);

         const isCollection = manager.isCollection(args.source),
               isLibraryFile = args.source.endsWith('.libragen'),
               isPackedCollection = args.source.endsWith('.libragen-collection'),
               isLocalPath = args.source.includes(path.sep) || args.source.startsWith('.'),
               isURL = args.source.startsWith('http://') || args.source.startsWith('https://');

         if (isPackedCollection) {
            await this.installPackedCollection(manager, args.source, flags, spinner);
         } else if (isCollection || (isURL && args.source.endsWith('.json'))) {
            await this.installCollection(manager, args.source, flags, spinner);
         } else if (isLibraryFile || isLocalPath) {
            await this.installLocalLibrary(manager, args.source, flags, spinner);
         } else if (isURL) {
            await this.installRemoteLibrary(manager, args.source, flags, spinner);
         } else {
            await this.installFromCollection(args.source, flags, spinner, manager);
         }

         console.log('');
      } catch(error) {
         spinner.fail('Installation failed');
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }

   private async installLocalLibrary(
      manager: LibraryManager,
      source: string,
      flags: { force: boolean },
      spinner: ReturnType<typeof import('ora').default>
   ): Promise<void> {
      const sourcePath = path.resolve(source);

      try {
         await fs.access(sourcePath);
      } catch(_e) {
         console.error(chalk.red(`Error: File not found: ${sourcePath}`));
         process.exit(1);
      }

      spinner.start(`Installing from ${sourcePath}...`);

      const installed = await manager.install(sourcePath, {
         force: flags.force,
      });

      spinner.succeed(`Installed ${chalk.bold(installed.name)} v${installed.version}`);
      console.log(`  ${chalk.dim('Location:')} ${installed.path}`);
   }

   private async installRemoteLibrary(
      manager: LibraryManager,
      source: string,
      flags: { force: boolean },
      spinner: ReturnType<typeof import('ora').default>
   ): Promise<void> {
      spinner.start(`Downloading from ${source}...`);

      const response = await fetch(source);

      if (!response.ok) {
         throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const tempPath = path.join(
         // eslint-disable-next-line no-process-env
         process.env.TMPDIR || '/tmp',
         `libragen-download-${Date.now()}.libragen`
      );

      const buffer = await response.arrayBuffer();

      await fs.writeFile(tempPath, Buffer.from(buffer));

      spinner.text = 'Installing...';

      const installed = await manager.install(tempPath, {
         force: flags.force,
      });

      await fs.unlink(tempPath);

      spinner.succeed(`Installed ${chalk.bold(installed.name)} v${installed.version}`);
      console.log(`  ${chalk.dim('Location:')} ${installed.path}`);
   }

   private async installCollection(
      manager: LibraryManager,
      source: string,
      flags: { force: boolean; all: boolean; select: boolean },
      spinner: ReturnType<typeof import('ora').default>
   ): Promise<void> {
      spinner.start('Resolving collection...');

      const preview = await manager.previewCollection(source);

      spinner.stop();

      console.log(chalk.bold('\nCollection contents:'));
      console.log(`  ${chalk.green('Required:')} ${preview.required.length} libraries`);

      for (const lib of preview.required) {
         console.log(`    • ${lib.name}`);
      }

      if (preview.optional.length > 0) {
         console.log(`  ${chalk.yellow('Optional:')} ${preview.optional.length} libraries`);

         for (const lib of preview.optional) {
            console.log(`    • ${lib.name}`);
         }
      }

      console.log('');

      let selectOptional: string[] | undefined;

      if (flags.select && preview.optional.length > 0) {
         console.log(chalk.dim('Use --all to include all optional libraries'));
         console.log('');
      }

      spinner.start('Installing collection...');

      const result = await manager.installCollection(source, {
         force: flags.force,
         includeOptional: flags.all,
         selectOptional,
         onProgress: (progress) => {
            if (progress.libraryName) {
               spinner.text = `${progress.phase}: ${progress.libraryName} (${progress.current}/${progress.total})`;
            } else {
               spinner.text = progress.message || 'Installing...';
            }
         },
      });

      spinner.succeed(`Installed collection ${chalk.bold(result.collectionName)}`);

      if (result.installed.length > 0) {
         console.log(`  ${chalk.green('Installed:')} ${result.installed.join(', ')}`);
      }

      if (result.skipped.length > 0) {
         console.log(`  ${chalk.yellow('Skipped:')} ${result.skipped.join(', ')} (already installed)`);
      }

      if (result.failed.length > 0) {
         console.log(`  ${chalk.red('Failed:')}`);

         for (const f of result.failed) {
            console.log(`    • ${f.name}: ${f.error}`);
         }
      }
   }

   private async installFromCollection(
      source: string,
      flags: { force: boolean; collection?: string },
      spinner: ReturnType<typeof import('ora').default>,
      manager: LibraryManager
   ): Promise<void> {
      spinner.start('Searching collections...');

      const client = new CollectionClient();

      await client.loadConfig();

      if (flags.collection) {
         await client.addCollection({
            name: 'custom',
            url: flags.collection,
            priority: 0,
         });
      }

      const collections = client.getCollections();

      if (collections.length === 0) {
         spinner.fail('No collections configured');
         console.log('');
         console.log('Add a collection with:');
         console.log(chalk.cyan('  libragen collection add <name> <url>'));
         process.exit(1);
      }

      const entry = await client.getEntry(source);

      if (!entry) {
         spinner.fail(`Library '${source}' not found in collections`);
         process.exit(1);
      }

      spinner.text = `Downloading ${entry.name} v${entry.version}...`;

      const tempPath = path.join(
         // eslint-disable-next-line no-process-env
         process.env.TMPDIR || '/tmp',
         `libragen-download-${Date.now()}.libragen`
      );

      await client.download(entry, tempPath, {
         onProgress: (progress: { percent: number }) => {
            spinner.text = `Downloading ${entry.name}... ${progress.percent.toFixed(0)}%`;
         },
      });

      spinner.text = 'Installing...';

      const installed = await manager.install(tempPath, {
         force: flags.force,
      });

      await fs.unlink(tempPath);

      spinner.succeed(`Installed ${chalk.bold(installed.name)} v${installed.version}`);
      console.log(`  ${chalk.dim('Location:')} ${installed.path}`);

      if (installed.contentVersion) {
         console.log(`  ${chalk.dim('Content:')} ${installed.contentVersion}`);
      }
   }

   private async installPackedCollection(
      manager: LibraryManager,
      source: string,
      flags: { force: boolean; all: boolean; select: boolean },
      spinner: ReturnType<typeof import('ora').default>
   ): Promise<void> {
      const sourcePath = path.resolve(source);

      try {
         await fs.access(sourcePath);
      } catch(_e) {
         console.error(chalk.red(`Error: File not found: ${sourcePath}`));
         process.exit(1);
      }

      spinner.start('Extracting packed collection...');

      const tar = await import('tar');

      const tempDir = path.join(
         // eslint-disable-next-line no-process-env
         process.env.TMPDIR || '/tmp',
         `libragen-install-${Date.now()}`
      );

      await fs.mkdir(tempDir, { recursive: true });

      await tar.extract({
         file: sourcePath,
         cwd: tempDir,
      });

      spinner.succeed('Extracted');

      const collectionPath = path.join(tempDir, 'collection.json');

      try {
         await fs.access(collectionPath);
      } catch(_e) {
         await fs.rm(tempDir, { recursive: true });
         throw new Error('Invalid packed collection: missing collection.json');
      }

      await this.installCollection(manager, collectionPath, flags, spinner);

      await fs.rm(tempDir, { recursive: true });
   }
}
