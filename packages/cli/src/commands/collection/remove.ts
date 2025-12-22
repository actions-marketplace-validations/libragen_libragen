/**
 * Collection remove command - Remove a collection
 */

/* eslint-disable no-console, no-process-exit */

import { Args } from '@oclif/core';
import chalk from 'chalk';
import { CollectionClient } from '@libragen/core';
import { BaseCommand } from '../../base-command.ts';

export default class CollectionRemove extends BaseCommand {
   public static override summary = 'Remove a collection';

   public static override description = 'Remove a configured collection source.';

   public static override examples = [
      '<%= config.bin %> <%= command.id %> my-team',
   ];

   public static override args = {
      name: Args.string({
         description: 'Collection name',
         required: true,
      }),
   };

   public async run(): Promise<void> {
      const { args } = await this.parse(CollectionRemove);

      try {
         const client = new CollectionClient();

         await client.loadConfig();

         const removed = await client.removeCollection(args.name);

         if (removed) {
            console.log(chalk.green(`\n✓ Removed collection '${args.name}'`));
            console.log('');
         } else {
            console.error(chalk.red(`\nError: Collection '${args.name}' not found`));
            process.exit(1);
         }
      } catch(error) {
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
