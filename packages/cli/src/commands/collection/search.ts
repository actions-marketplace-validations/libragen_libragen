/**
 * Collection search command - Search collections for libraries
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import { CollectionClient } from '@libragen/core';
import { BaseCommand } from '../../base-command.ts';

export default class CollectionSearch extends BaseCommand {
   public static override summary = 'Search collections for libraries';

   public static override description = 'Search configured collections for available libraries.';

   public static override examples = [
      '<%= config.bin %> <%= command.id %> react',
      '<%= config.bin %> <%= command.id %> next.js --json',
   ];

   public static override args = {
      query: Args.string({
         description: 'Search query',
         required: true,
      }),
   };

   public static override flags = {
      json: Flags.boolean({
         description: 'Output as JSON',
         default: false,
      }),
      'content-version': Flags.string({
         description: 'Filter by content version',
      }),
   };

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(CollectionSearch);

      try {
         const client = new CollectionClient();

         await client.loadConfig();

         const collections = client.getCollections();

         if (collections.length === 0) {
            console.error(chalk.yellow('\nNo collections configured.'));
            console.log('Add a collection with:');
            console.log(chalk.cyan('  libragen collection add <name> <url>'));
            process.exit(1);
         }

         const results = await client.search(args.query, {
            contentVersion: flags['content-version'],
         });

         if (flags.json) {
            console.log(JSON.stringify(results, null, 2));
            return;
         }

         if (results.length === 0) {
            console.log(chalk.yellow(`\nNo libraries found matching '${args.query}'`));
            console.log('');
            return;
         }

         console.log(chalk.bold(`\n🔍 Search Results (${results.length})\n`));

         for (const entry of results) {
            console.log(`  ${chalk.bold(entry.name)} ${chalk.dim(`v${entry.version}`)}`);

            if (entry.contentVersion) {
               console.log(`    ${chalk.dim('Content:')} ${entry.contentVersion}`);
            }

            if (entry.description) {
               console.log(`    ${chalk.dim(entry.description)}`);
            }

            console.log(`    ${chalk.dim('Collection:')} ${entry.collection}`);
            console.log('');
         }

         console.log('Install with:');
         console.log(chalk.cyan('  libragen install <name>'));
         console.log('');
      } catch(error) {
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
