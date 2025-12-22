/**
 * Collection list command - List configured collections
 */

/* eslint-disable no-console, no-process-exit */

import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { CollectionClient } from '@libragen/core';
import { BaseCommand } from '../../base-command.ts';

export default class CollectionList extends BaseCommand {
   public static override summary = 'List configured collections';

   public static override description = 'Display all configured collection sources.';

   public static override examples = [
      '<%= config.bin %> <%= command.id %>',
      '<%= config.bin %> <%= command.id %> --json',
   ];

   public static override flags = {
      json: Flags.boolean({
         description: 'Output as JSON',
         default: false,
      }),
   };

   public async run(): Promise<void> {
      const { flags } = await this.parse(CollectionList);

      try {
         const client = new CollectionClient();

         await client.loadConfig();

         const collections = client.getCollections();

         if (flags.json) {
            console.log(JSON.stringify(collections, null, 2));
            return;
         }

         if (collections.length === 0) {
            console.log(chalk.yellow('\nNo collections configured.\n'));
            console.log('Add a collection with:');
            console.log(chalk.cyan('  libragen collection add <name> <url>'));
            console.log('');
            return;
         }

         console.log(chalk.bold('\n📦 Configured Collections\n'));

         for (const coll of collections) {
            console.log(`  ${chalk.bold(coll.name)} ${chalk.dim(`(priority: ${coll.priority})`)}`);
            console.log(`    ${chalk.dim(coll.url)}`);
            console.log('');
         }
      } catch(error) {
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
