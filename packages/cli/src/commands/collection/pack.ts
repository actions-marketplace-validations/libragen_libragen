/**
 * Collection pack command - Bundle a collection and its libraries
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import * as tar from 'tar';
import { formatBytes } from '@libragen/core';
import type { CollectionDefinition } from '@libragen/core';
import { BaseCommand } from '../../base-command.ts';

export default class CollectionPack extends BaseCommand {
   public static override summary = 'Bundle a collection and its libraries into a single file';

   public static override description = `Pack a collection and all its libraries into a distributable archive.
The resulting .libragen-collection file can be shared and installed with \`libragen install\`.`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %> ./my-collection.json',
      '<%= config.bin %> <%= command.id %> ./my-collection.json -o my-bundle.libragen-collection',
   ];

   public static override args = {
      collection: Args.string({
         description: 'Collection file (.json) to pack',
         required: true,
      }),
   };

   public static override flags = {
      output: Flags.string({
         char: 'o',
         description: 'Output file path (.libragen-collection)',
      }),
   };

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(CollectionPack);

      const spinner = this.createSpinner();

      try {
         const collectionPath = path.resolve(args.collection);

         spinner.start('Reading collection...');

         const collectionContent = await fs.readFile(collectionPath, 'utf-8');

         const collectionDef: CollectionDefinition = JSON.parse(collectionContent);

         const collectionDir = path.dirname(collectionPath);

         const libraries: { name: string; sourcePath: string }[] = [];

         for (const item of collectionDef.items) {
            if (item.library) {
               const libPath = path.isAbsolute(item.library)
                  ? item.library
                  : path.resolve(collectionDir, item.library);

               try {
                  await fs.access(libPath);
                  libraries.push({
                     name: path.basename(libPath),
                     sourcePath: libPath,
                  });
               } catch(_e) {
                  spinner.fail(`Library not found: ${item.library}`);
                  process.exit(1);
               }
            }
         }

         spinner.succeed(`Found ${libraries.length} libraries`);

         const outputPath = flags.output || `${collectionDef.name || 'collection'}.libragen-collection`;

         const tempDir = path.join(
            // eslint-disable-next-line no-process-env
            process.env.TMPDIR || '/tmp',
            `libragen-pack-${Date.now()}`
         );

         await fs.mkdir(tempDir, { recursive: true });

         spinner.start('Copying libraries...');

         for (const lib of libraries) {
            await fs.copyFile(lib.sourcePath, path.join(tempDir, lib.name));
         }

         const packedCollection: CollectionDefinition = {
            ...collectionDef,
            items: collectionDef.items.map((item) => {
               if (item.library) {
                  return {
                     ...item,
                     library: `./${path.basename(item.library)}`,
                  };
               }

               return item;
            }),
         };

         await fs.writeFile(
            path.join(tempDir, 'collection.json'),
            JSON.stringify(packedCollection, null, 2)
         );

         spinner.succeed('Prepared files');

         spinner.start('Creating archive...');

         await tar.create(
            {
               gzip: true,
               file: outputPath,
               cwd: tempDir,
            },
            [ '.' ]
         );

         await fs.rm(tempDir, { recursive: true });

         const stats = await fs.stat(outputPath);

         spinner.succeed('Archive created');

         console.log(chalk.bold.green('\n✓ Packed collection successfully!\n'));
         console.log(`  ${chalk.dim('File:')}      ${path.resolve(outputPath)}`);
         console.log(`  ${chalk.dim('Size:')}      ${formatBytes(stats.size)}`);
         console.log(`  ${chalk.dim('Libraries:')} ${libraries.length}`);
         console.log('');
         console.log('Share this file, then unpack with:');
         console.log(chalk.cyan(`  libragen collection unpack ${outputPath}`));
         console.log('');
      } catch(error) {
         spinner.fail('Pack failed');
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
