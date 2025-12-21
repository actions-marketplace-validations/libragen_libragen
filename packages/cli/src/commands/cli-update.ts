/**
 * CLI self-update command - updates the CLI itself via npm
 */

import { execSync } from 'child_process';
import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { BaseCommand } from '../base-command.ts';

/**
 * Update the libragen CLI to the latest version.
 */
export default class CliUpdate extends BaseCommand {

   public static override summary = 'Update the libragen CLI to the latest version';

   public static override description = `Check for and install updates to the libragen CLI.
Fetches the latest version from npm and installs it globally.`;

   public static override examples = [
      '<%= config.bin %> cli-update',
      '<%= config.bin %> cli-update --check',
   ];

   public static override flags = {
      check: Flags.boolean({
         char: 'c',
         description: 'Check for updates without installing',
      }),
   };

   public async run(): Promise<void> {
      const { flags } = await this.parse(CliUpdate);

      const currentVersion = this.config.version;

      const packageName = this.config.pjson.name;

      this.log(`Current version: ${chalk.cyan(currentVersion)}`);

      // Fetch latest version from npm
      let latestVersion: string;

      try {
         const result = execSync(`npm view ${packageName} version`, { encoding: 'utf-8' });

         latestVersion = result.trim();
      } catch{
         this.error('Failed to fetch latest version from npm');
      }

      this.log(`Latest version:  ${chalk.cyan(latestVersion)}`);

      if (currentVersion === latestVersion) {
         this.log(chalk.green('\n✓ You are already on the latest version'));
         return;
      }

      if (flags.check) {
         this.log(chalk.yellow(`\nUpdate available: ${currentVersion} → ${latestVersion}`));
         this.log(`Run ${chalk.cyan('libragen cli-update')} to update`);
         return;
      }

      this.log(`\nUpdating ${packageName}...`);

      try {
         execSync(`npm install -g ${packageName}@latest`, { stdio: 'inherit' });
         this.log(chalk.green(`\n✓ Updated to ${latestVersion}`));
      } catch{
         this.error('Failed to update. Try running: npm install -g @libragen/cli@latest');
      }
   }
}
