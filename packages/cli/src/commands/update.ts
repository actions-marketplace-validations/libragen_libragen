/**
 * Update command - Update installed libraries to newer versions
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import {
   LibraryManager,
   CollectionClient,
   findUpdates,
   performUpdate,
} from '@libragen/core';
import type { UpdateCandidate } from '@libragen/core';
import { BaseCommand } from '../base-command.ts';

export default class Update extends BaseCommand {
   public static override summary = 'Update libraries from their collections';

   public static override description = `Update installed libraries to newer versions from their collections.
Only works for libraries that were installed from collections.`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %>',
      '<%= config.bin %> <%= command.id %> next.js',
      '<%= config.bin %> <%= command.id %> --dry-run',
   ];

   public static override args = {
      name: Args.string({
         description: 'Library name to update (updates all collection libraries if omitted)',
         required: false,
      }),
   };

   public static override flags = {
      path: Flags.string({
         char: 'p',
         description: 'Project directory (will search <path>/.libragen/libraries)',
         multiple: true,
      }),
      force: Flags.boolean({
         char: 'f',
         description: 'Force update even if versions match',
         default: false,
      }),
      'dry-run': Flags.boolean({
         char: 'n',
         description: 'Show what would be updated without making changes',
         default: false,
      }),
   };

   public static override aliases = [ 'up' ];

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(Update);

      const spinner = this.createSpinner();

      try {
         const transformedPaths = this.transformPaths(flags.path);

         const managerOptions = transformedPaths ? { paths: transformedPaths } : undefined;

         const manager = new LibraryManager(managerOptions);

         const client = new CollectionClient();

         await client.loadConfig();

         spinner.start('Checking installed libraries...');

         const installed = await manager.listInstalled();

         if (installed.length === 0) {
            spinner.info('No libraries installed');
            return;
         }

         const toCheck = args.name
            ? installed.filter((lib) => {
               return lib.name === args.name;
            })
            : installed;

         if (args.name && toCheck.length === 0) {
            spinner.fail(`Library '${args.name}' is not installed`);
            process.exit(1);
         }

         spinner.text = 'Checking for updates...';

         const updates = await findUpdates(toCheck, client, { force: flags.force });

         spinner.stop();

         if (updates.length === 0) {
            console.log(chalk.green('✓ All libraries are up to date'));
            return;
         }

         this.displayUpdates(updates);

         if (flags['dry-run']) {
            console.log(chalk.yellow('Dry run - no changes made'));
            return;
         }

         spinner.start('Updating libraries...');

         let updated = 0,
             failed = 0;

         for (const update of updates) {
            spinner.text = `Updating ${update.name}...`;

            try {
               await performUpdate(update, manager);
               updated += 1;
            } catch(error) {
               const msg = error instanceof Error ? error.message : String(error);

               console.error(chalk.red(`\n  Failed to update ${update.name}: ${msg}`));
               failed += 1;
            }
         }

         if (updated > 0) {
            spinner.succeed(`Updated ${updated} ${updated === 1 ? 'library' : 'libraries'}`);
         } else {
            spinner.stop();
         }

         if (failed > 0) {
            console.log(chalk.red(`  ${failed} ${failed === 1 ? 'library' : 'libraries'} failed to update`));
            process.exit(1);
         }

         console.log('');
      } catch(error) {
         spinner.fail('Update failed');
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }

   private displayUpdates(updates: UpdateCandidate[]): void {
      console.log(chalk.bold('\nUpdates available:'));
      console.log('');

      for (const update of updates) {
         const versionChange = update.currentVersion === update.newVersion
            ? chalk.dim(update.currentVersion)
            : `${chalk.dim(update.currentVersion)} → ${chalk.green(update.newVersion)}`;

         let contentChange = '';

         if (update.newContentVersion && update.currentContentVersion !== update.newContentVersion) {
            const current = update.currentContentVersion || 'unknown';

            contentChange = ` (content: ${chalk.dim(current)} → ${chalk.green(update.newContentVersion)})`;
         }

         console.log(`  ${chalk.bold(update.name)} ${versionChange}${contentChange}`);
      }

      console.log('');
   }
}
