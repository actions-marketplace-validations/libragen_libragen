/**
 * Collection clear-cache command - Clear the collection cache
 */

/* eslint-disable no-console, no-process-exit */

import chalk from 'chalk';
import { CollectionClient } from '@libragen/core';
import { BaseCommand } from '../../base-command.ts';

export default class CollectionClearCache extends BaseCommand {
   public static override summary = 'Clear the collection cache';

   public static override description = 'Clear cached collection data to force fresh fetches.';

   public static override examples = [
      '<%= config.bin %> <%= command.id %>',
   ];

   public async run(): Promise<void> {
      try {
         const client = new CollectionClient();

         await client.clearCache();

         console.log(chalk.green('\n✓ Collection cache cleared'));
         console.log('');
      } catch(error) {
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
