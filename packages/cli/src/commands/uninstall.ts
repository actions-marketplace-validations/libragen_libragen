/**
 * Uninstall command - Remove an installed library or collection
 */

/* eslint-disable no-console, no-process-exit */

import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import { LibraryManager } from '@libragen/core';
import { BaseCommand } from '../base-command.ts';

export default class Uninstall extends BaseCommand {
   public static override summary = 'Remove an installed library or collection';

   public static override description = `Uninstall a libragen library or collection by name.
For collections, use the --collection flag.`;

   public static override examples = [
      '<%= config.bin %> <%= command.id %> next.js',
      '<%= config.bin %> <%= command.id %> my-collection --collection',
   ];

   public static override args = {
      name: Args.string({
         description: 'Library or collection name to uninstall',
         required: true,
      }),
   };

   public static override flags = {
      path: Flags.string({
         char: 'p',
         description: 'Project directory (will search <path>/.libragen/libraries)',
         multiple: true,
      }),
      collection: Flags.boolean({
         char: 'c',
         description: 'Uninstall a collection (and unreferenced libraries)',
         default: false,
      }),
   };

   public static override aliases = [ 'u' ];

   public async run(): Promise<void> {
      const { args, flags } = await this.parse(Uninstall);

      try {
         const transformedPaths = this.transformPaths(flags.path);

         const managerOptions = transformedPaths ? { paths: transformedPaths } : undefined;

         const manager = new LibraryManager(managerOptions);

         if (flags.collection) {
            const collection = await manager.getCollection(args.name);

            if (!collection) {
               console.error(chalk.red(`\nError: Collection '${args.name}' not found`));
               process.exit(1);
            }

            const removed = await manager.uninstallCollection(args.name);

            console.log(chalk.green(`\n✓ Uninstalled collection ${chalk.bold(args.name)}`));

            if (removed.length > 0) {
               console.log(`  ${chalk.dim('Removed libraries:')} ${removed.join(', ')}`);
            } else {
               console.log(`  ${chalk.dim('No libraries removed (still used by other collections)')}`);
            }

            console.log('');
         } else {
            const lib = await manager.find(args.name);

            if (!lib) {
               const collection = await manager.getCollection(args.name);

               if (collection) {
                  console.error(chalk.red(`\nError: '${args.name}' is a collection, not a library`));
                  console.log(chalk.dim('Use --collection flag to uninstall collections'));
                  process.exit(1);
               }

               console.error(chalk.red(`\nError: Library '${args.name}' not found`));
               process.exit(1);
            }

            const removed = await manager.uninstall(args.name);

            if (removed) {
               console.log(chalk.green(`\n✓ Uninstalled ${chalk.bold(args.name)}`));
               console.log(`  ${chalk.dim('Removed:')} ${lib.path}`);
               console.log('');
            } else {
               console.log(chalk.yellow(`\n⚠ Library '${args.name}' is still used by a collection`));
               console.log(chalk.dim('  Uninstall the collection first, or the library will remain'));
               console.log('');
            }
         }
      } catch(error) {
         console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
         process.exit(1);
      }
   }
}
