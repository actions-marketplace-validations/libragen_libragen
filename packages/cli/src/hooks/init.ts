/**
 * Init hook - Check for CLI updates on specific commands
 */

import type { Hook } from '@oclif/core';
import { checkForUpdate } from '../utils/check-for-updates.ts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const hook: Hook<'init'> = async function(_options) {
   try {
      const args = process.argv.slice(2);

      const isHelp = args.includes('--help') || args.includes('-h') || args.includes('help');

      const isNoArgs = args.length === 0;

      const targetCommands = [ 'build', 'install', 'inspect', 'update', 'config' ];

      const isTargetCommand = targetCommands.some((cmd) => {
         return args.includes(cmd);
      });

      if (isHelp || isNoArgs || isTargetCommand) {
         await checkForUpdate();
      }
   } catch(_e) {
      // Ignore update check failures - don't block CLI execution
   }
};

export default hook;
