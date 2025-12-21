/**
 * Collection add command - Add a collection
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import { CollectionClient } from '@libragen/core';
import { BaseCommand } from '../../base-command.ts';

export default class CollectionAdd extends BaseCommand {
   public static override summary = 'Add a collection';

   public static override description = 'Add a new collection source for discovering libraries.';

   public static override examples = [
      '<%= config.bin %> <%= command.id %> official https://libragen.dev/collections/official.json',
      '<%= config.bin %> <%= command.id %> my-team https://example.com/collection.json --priority 5',
   ];

   public static override args = {
      name: Args.string({
         description: 'Collection name',
         required: true,
      }),
      url: Args.string({
         description: 'Collection URL',
         required: true,
      }),
   };

   public static override flags = {
      priority: Flags.integer({
         char: 'p',
         description: 'Priority (lower = higher priority)',
         default: 10,
      }),
   };

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(CollectionAdd);

      try {
         const client = new CollectionClient();

         await client.loadConfig();

         await client.addCollection({
            name: args.name,
            url: args.url,
            priority: flags.priority,
         });

         console.log(chalk.green(`\n✓ Added collection '${args.name}'`));
         console.log(`  ${chalk.dim('URL:')} ${args.url}`);
         console.log(`  ${chalk.dim('Priority:')} ${flags.priority}`);
         console.log('');
      } catch(error) {
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
