/**
 * libragen_config MCP tool
 *
 * Returns libragen configuration including paths and discovered project directories.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
   VERSION,
   getLibragenHome,
   getDefaultLibraryDir,
   getModelCacheDir,
} from '@libragen/core';
import { getLibraryPaths, libraryPaths } from '../server.ts';

interface ConfigResult {
   version: string;
   paths: {
      home: string;
      libraries: string;
      models: string;
   };
   discoveredPaths: string[];
   pathsInitialized: boolean;
   environment: {
      LIBRAGEN_HOME: string | null;
      LIBRAGEN_MODEL_CACHE: string | null;
   };
}

/**
 * Register the libragen_config tool with the MCP server.
 */
export function registerConfigTool(server: McpServer): void {
   const toolConfig = {
      title: 'Libragen Configuration',
      description: `Get libragen configuration including paths, version, and discovered project directories.

USE THIS TOOL when you need to:
- Check where libraries are stored
- See which project-local .libragen directories were discovered
- Verify environment variable settings
- Debug path resolution issues

Returns:
- version: libragen version
- paths: default paths (home, libraries, models)
- discoveredPaths: all library paths being searched (includes project-local)
- pathsInitialized: whether paths have been discovered from workspace roots
- environment: active environment variable overrides`,
      inputSchema: {},
   };

   server.registerTool('libragen_config', toolConfig, async () => {
      // eslint-disable-next-line no-process-env
      const env = process.env;

      const config: ConfigResult = {
         version: VERSION,
         paths: {
            home: getLibragenHome(),
            libraries: getDefaultLibraryDir(),
            models: getModelCacheDir(),
         },
         discoveredPaths: getLibraryPaths(),
         pathsInitialized: libraryPaths.initialized,
         environment: {
            LIBRAGEN_HOME: env.LIBRAGEN_HOME || null,
            LIBRAGEN_MODEL_CACHE: env.LIBRAGEN_MODEL_CACHE || null,
         },
      };

      const lines: string[] = [
         '⚙️  Libragen Configuration',
         '',
         `Version: ${config.version}`,
         '',
         'Default Paths:',
         `  Home:      ${config.paths.home}${config.environment.LIBRAGEN_HOME ? ' (from LIBRAGEN_HOME)' : ''}`,
         `  Libraries: ${config.paths.libraries}`,
         `  Models:    ${config.paths.models}${config.environment.LIBRAGEN_MODEL_CACHE ? ' (from LIBRAGEN_MODEL_CACHE)' : ''}`,
         '',
         'Library Search Paths (in priority order):',
      ];

      for (const p of config.discoveredPaths) {
         const isGlobal = p === config.paths.libraries;

         lines.push(`  ${isGlobal ? '🌐' : '📁'} ${p}${isGlobal ? ' (global)' : ' (project-local)'}`);
      }

      if (!config.pathsInitialized) {
         lines.push('');
         lines.push('Note: Workspace roots not yet discovered. Project-local paths may be added after initialization.');
      }

      lines.push('');
      lines.push('Environment Variables:');

      if (config.environment.LIBRAGEN_HOME || config.environment.LIBRAGEN_MODEL_CACHE) {
         if (config.environment.LIBRAGEN_HOME) {
            lines.push(`  LIBRAGEN_HOME=${config.environment.LIBRAGEN_HOME}`);
         }
         if (config.environment.LIBRAGEN_MODEL_CACHE) {
            lines.push(`  LIBRAGEN_MODEL_CACHE=${config.environment.LIBRAGEN_MODEL_CACHE}`);
         }
      } else {
         lines.push('  (none set, using defaults)');
      }

      return {
         content: [ { type: 'text' as const, text: lines.join('\n') } ],
      };
   });
}
