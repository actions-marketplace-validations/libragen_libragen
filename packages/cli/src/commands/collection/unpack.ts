/**
 * Collection unpack command - Extract a packed collection
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import * as tar from 'tar';
import type { CollectionDefinition } from '@libragen/core';
import { BaseCommand } from '../../base-command.ts';

export default class CollectionUnpack extends BaseCommand {
   public static override summary = 'Extract a packed collection to a directory';

   public static override description = `Unpack a .libragen-collection archive to access the collection file and libraries.
Optionally install the collection immediately after unpacking.`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %> ./bundle.libragen-collection',
      '<%= config.bin %> <%= command.id %> ./bundle.libragen-collection -o ./my-libs',
      '<%= config.bin %> <%= command.id %> ./bundle.libragen-collection --install',
   ];

   public static override args = {
      pack: Args.string({
         description: 'Packed collection file (.libragen-collection)',
         required: true,
      }),
   };

   public static override flags = {
      output: Flags.string({
         char: 'o',
         description: 'Output directory (default: current directory)',
      }),
      install: Flags.boolean({
         char: 'i',
         description: 'Install the collection after unpacking',
         default: false,
      }),
   };

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(CollectionUnpack);

      const spinner = this.createSpinner();

      try {
         const packPath = path.resolve(args.pack);

         try {
            await fs.access(packPath);
         } catch(_e) {
            console.error(chalk.red(`Error: File not found: ${packPath}`));
            process.exit(1);
         }

         const outputDir = flags.output ? path.resolve(flags.output) : process.cwd();

         spinner.start('Extracting archive...');

         await fs.mkdir(outputDir, { recursive: true });

         await tar.extract({
            file: packPath,
            cwd: outputDir,
         });

         spinner.succeed('Extracted archive');

         const collectionPath = path.join(outputDir, 'collection.json');

         const collectionContent = await fs.readFile(collectionPath, 'utf-8');

         const collectionDef: CollectionDefinition = JSON.parse(collectionContent);

         const libraryCount = collectionDef.items.filter((i) => { return i.library; }).length;

         console.log(chalk.bold.green(`\n✓ Unpacked collection '${collectionDef.name}'!\n`));
         console.log(`  ${chalk.dim('Location:')}  ${outputDir}`);
         console.log(`  ${chalk.dim('Libraries:')} ${libraryCount}`);
         console.log('');

         if (flags.install) {
            spinner.start('Installing collection...');

            const { LibraryManager } = await import('@libragen/core');

            const manager = new LibraryManager();

            const result = await manager.installCollection(collectionPath, {
               force: false,
               includeOptional: false,
            });

            spinner.succeed(`Installed ${result.installed.length} libraries`);

            if (result.skipped.length > 0) {
               console.log(`  ${chalk.yellow('Skipped:')} ${result.skipped.join(', ')} (already installed)`);
            }
         } else {
            console.log('Install with:');
            console.log(chalk.cyan(`  libragen install ${collectionPath}`));
         }

         console.log('');
      } catch(error) {
         spinner.fail('Unpack failed');
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
