/**
 * Base command class for all libragen CLI commands.
 * Provides shared functionality like error handling, path transformation, etc.
 */

import { Command, Flags } from '@oclif/core';
import * as path from 'path';
import ora from 'ora';
import chalk from 'chalk';

/**
 * Abstract base command that all libragen commands extend.
 */
export abstract class BaseCommand extends Command {

   /**
    * Common path flag used by multiple commands.
    * Transforms project directories to .libragen/libraries subdirectories.
    */
   // eslint-disable-next-line @typescript-eslint/naming-convention
   public static baseFlags = {
      path: Flags.string({
         char: 'p',
         description: 'Project directory (will use <path>/.libragen/libraries)',
         multiple: true,
      }),
   };

   /**
    * Transform user-provided paths to .libragen/libraries subdirectories.
    */
   protected transformPaths(paths: string[] | undefined): string[] | undefined {
      if (!paths) {
         return undefined;
      }

      return paths.map((p) => {
         return path.join(p, '.libragen', 'libraries');
      });
   }

   /**
    * Create a spinner instance for progress indication.
    */
   protected createSpinner(): ReturnType<typeof ora> {
      return ora();
   }

   /**
    * Handle errors consistently across all commands.
    */
   protected handleError(error: unknown, spinner?: ReturnType<typeof ora>): never {
      if (spinner?.isSpinning) {
         spinner.fail();
      }

      const message = error instanceof Error ? error.message : String(error);

      this.error(chalk.red(`Error: ${message}`));
   }

   /**
    * Log a success message with green checkmark.
    */
   protected logSuccess(message: string): void {
      this.log(chalk.green(`✓ ${message}`));
   }

   /**
    * Log an info message with dim styling.
    */
   protected logInfo(label: string, value: string): void {
      this.log(`  ${chalk.dim(`${label}:`)} ${value}`);
   }
}
