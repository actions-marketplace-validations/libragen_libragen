/**
 * Collection create command - Create a new collection file
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import type { CollectionDefinition, CollectionItem } from '@libragen/core';
import { BaseCommand } from '../../base-command.ts';

export default class CollectionCreate extends BaseCommand {
   public static override summary = 'Create a new collection file';

   public static override description = `Create a collection definition file (.json).
Creates a template if no libraries are specified.`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %> my-collection.json',
      '<%= config.bin %> <%= command.id %> my-collection.json -l ./lib1.libragen -l ./lib2.libragen',
      '<%= config.bin %> <%= command.id %> my-collection.json --name "My Collection" --description "A collection of docs"',
   ];

   public static override args = {
      output: Args.string({
         description: 'Output file path (.json)',
         required: true,
      }),
   };

   public static override flags = {
      name: Flags.string({
         char: 'n',
         description: 'Collection name',
      }),
      description: Flags.string({
         char: 'd',
         description: 'Collection description',
      }),
      version: Flags.string({
         char: 'v',
         description: 'Collection version',
         default: '1.0.0',
      }),
      library: Flags.string({
         char: 'l',
         description: 'Add library (can be used multiple times)',
         multiple: true,
      }),
      collection: Flags.string({
         char: 'c',
         description: 'Add nested collection (can be used multiple times)',
         multiple: true,
      }),
      optional: Flags.string({
         char: 'o',
         description: 'Add optional library (can be used multiple times)',
         multiple: true,
      }),
   };

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(CollectionCreate);

      try {
         const outputPath = args.output.endsWith('.json') ? args.output : `${args.output}.json`;

         const name = flags.name || path.basename(outputPath, '.json');

         const hasItems = flags.library?.length || flags.optional?.length || flags.collection?.length;

         const items = this.buildItems(flags, hasItems);

         const definition: CollectionDefinition = {
            name,
            version: flags.version,
            items,
         };

         if (flags.description) {
            definition.description = flags.description;
         } else if (!hasItems) {
            definition.description = 'My library collection';
         }

         await fs.writeFile(outputPath, JSON.stringify(definition, null, 2) + '\n');

         this.printOutput(name, outputPath, flags, hasItems);
      } catch(error) {
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }

   private buildItems(
      flags: { library?: string[]; optional?: string[]; collection?: string[] },
      hasItems: number | undefined
   ): CollectionItem[] {
      const items: CollectionItem[] = [];

      if (hasItems) {
         for (const lib of flags.library || []) {
            items.push({ library: lib });
         }

         for (const lib of flags.optional || []) {
            items.push({ library: lib, required: false });
         }

         for (const coll of flags.collection || []) {
            items.push({ collection: coll });
         }
      } else {
         items.push({ library: 'https://example.com/library.libragen' });
      }

      return items;
   }

   private printOutput(
      name: string,
      outputPath: string,
      flags: { library?: string[]; optional?: string[]; collection?: string[] },
      hasItems: number | undefined
   ): void {
      if (hasItems) {
         console.log(chalk.green(`\n✓ Created collection '${name}'`));
         console.log(`  ${chalk.dim('File:')} ${outputPath}`);
         const libCount = (flags.library?.length || 0) + (flags.optional?.length || 0);

         console.log(`  ${chalk.dim('Libraries:')} ${libCount}`);

         if (flags.optional?.length) {
            console.log(`  ${chalk.dim('Optional:')} ${flags.optional.length}`);
         }

         if (flags.collection?.length) {
            console.log(`  ${chalk.dim('Nested collections:')} ${flags.collection.length}`);
         }

         console.log('');
         console.log('Install with:');
         console.log(chalk.cyan(`  libragen install ${outputPath}`));
         console.log('');
      } else {
         this.printTemplateOutput(name, outputPath);
      }
   }

   private printTemplateOutput(name: string, outputPath: string): void {
      console.log(chalk.green(`\n✓ Created collection template '${name}'`));
      console.log(`  ${chalk.dim('File:')} ${outputPath}`);
      console.log('');
      console.log('Edit the file to add your libraries, then install with:');
      console.log(chalk.cyan(`  libragen install ${outputPath}`));
      console.log('');
      console.log(chalk.dim('Collection format:'));
      console.log(chalk.dim('  { "library": "path/to/lib.libragen" }           - Required library'));
      console.log(chalk.dim('  { "library": "...", "required": false }         - Optional library'));
      console.log(chalk.dim('  { "collection": "path/to/other.json" }          - Nested collection'));
      console.log('');
   }
}
