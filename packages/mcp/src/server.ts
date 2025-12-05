/**
 * MCP Server configuration and setup
 *
 * Creates and configures the MCP server with all libragen tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { VERSION, Embedder, getDefaultLibraryDir, detectProjectLibraryDir, hasProjectLibraryDir } from '@libragen/core';
import type { IEmbedder } from '@libragen/core';
import { registerSearchTool } from './tools/search.ts';
import { registerListTool } from './tools/list.ts';
import { registerInstallTool } from './tools/install.ts';
import { registerUninstallTool } from './tools/uninstall.ts';
import { registerUpdateTool } from './tools/update.ts';
import { registerBuildTool } from './tools/build.ts';
import { registerCollectionTool } from './tools/collection.ts';
import { registerConfigTool } from './tools/config.ts';
import { registerPrompts } from './prompts/index.ts';

export interface ServerConfig {

   /** Directory containing library files (default: platform-specific) */
   librariesDir?: string;

   /** Pre-warmed embedder instance (for faster first query) */
   embedder?: IEmbedder;
}

/**
 * Shared state for library paths discovered from MCP roots.
 * This is updated when the server receives roots from the client.
 */
export interface LibraryPaths {

   /** All library paths to search, in priority order */
   paths: string[];

   /** Whether paths have been initialized from roots */
   initialized: boolean;
}

/** Global library paths state, updated by roots discovery */
export const libraryPaths: LibraryPaths = {
   paths: [ getDefaultLibraryDir() ],
   initialized: false,
};

/**
 * WeakMap to associate server configurations with McpServer instances.
 * This avoids extending the McpServer class or using any casts.
 */
const serverConfigs = new WeakMap<McpServer, ServerConfig>();

/**
 * Update library paths based on MCP roots.
 * Called when the server receives roots from the client.
 */
export async function updateLibraryPathsFromRoots(roots: Array<{ uri: string; name?: string }>): Promise<void> {
   const paths: string[] = [];

   // Check each root for a .libragen/libraries directory
   for (const root of roots) {
      // Convert file:// URI to path
      let rootPath: string;

      if (root.uri.startsWith('file://')) {
         rootPath = root.uri.slice(7);
         // Handle Windows paths (file:///C:/...)
         if (rootPath.match(/^\/[A-Za-z]:\//)) {
            rootPath = rootPath.slice(1);
         }
      } else {
         rootPath = root.uri;
      }

      const projectLibDir = detectProjectLibraryDir(rootPath);

      if (projectLibDir && await hasProjectLibraryDir(rootPath)) {
         paths.push(projectLibDir);
      }
   }

   // Always include global directory
   paths.push(getDefaultLibraryDir());

   libraryPaths.paths = paths;
   libraryPaths.initialized = true;
}

/**
 * Get the current library paths.
 * Returns paths discovered from roots, or defaults if not yet initialized.
 */
export function getLibraryPaths(): string[] {
   return libraryPaths.paths;
}

/**
 * Create and configure the MCP server with all libragen tools.
 */
export function createServer(config: ServerConfig = {}): McpServer {
   const server = new McpServer({
      name: 'libragen',
      version: VERSION,
   });

   // Store config in WeakMap to avoid any casting
   serverConfigs.set(server, config);

   // Register all tools
   registerSearchTool(server, config);
   registerListTool(server, config);
   registerBuildTool(server, config);
   registerInstallTool(server);
   registerUninstallTool(server);
   registerUpdateTool(server);
   registerCollectionTool(server);
   registerConfigTool(server);

   // Register prompts (slash commands)
   registerPrompts(server);

   return server;
}

/**
 * Update the embedder instance on an existing server.
 * This allows lazy initialization and background warming.
 */
export function updateServerEmbedder(server: McpServer, embedder: IEmbedder): void {
   const config = serverConfigs.get(server);

   if (config) {
      config.embedder = embedder;
   }
}

/**
 * Pre-warm the embedding model by loading it into memory.
 * Call this at server startup for faster first query response.
 */
export async function warmEmbedder(): Promise<Embedder> {
   const embedder = new Embedder();

   // Force model download and initialization
   await embedder.embed('warmup');

   return embedder;
}
