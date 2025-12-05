#!/usr/bin/env node
/**
 * @libragen/mcp - MCP server for libragen
 *
 * Entry point for the MCP server that exposes libragen functionality
 * to AI coding assistants via the Model Context Protocol.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, warmEmbedder, updateServerEmbedder, updateLibraryPathsFromRoots } from './server.ts';

async function main(): Promise<void> {
   // Create server without embedder (lazy initialization)
   const server = createServer();

   // Connect via stdio transport (standard for MCP servers)
   const transport = new StdioServerTransport();

   await server.connect(transport);

   // Start background embedder warming after server is ready
   // This allows the server to respond immediately while model loads in background
   warmEmbedderWithRetry(server).catch((error) => {
      // Log error but don't crash server - tools will create embedder on demand
      // eslint-disable-next-line no-console
      console.warn('Failed to warm embedder, tools will create embedder on demand:', error);
   });

   // Try to get roots from the client to discover project directories
   // This enables auto-detection of .libragen/libraries in workspace roots
   try {
      // The server object has a client property after connection
      // that can be used to make requests to the client
      const mcpServer = server as unknown as {
         server?: {
            listRoots?: () => Promise<{ roots: Array<{ uri: string; name?: string }> }>;
         };
      };

      if (mcpServer.server?.listRoots) {
         const rootsResult = await mcpServer.server.listRoots();

         if (rootsResult?.roots) {
            await updateLibraryPathsFromRoots(rootsResult.roots);
         }
      }
   } catch{
      // Client may not support roots - that's fine, we'll use defaults
   }
}

/**
 * Attempt to warm the embedder with retry logic.
 * If warming fails, the server will still work but search operations
 * may be slower on first use.
 */
async function warmEmbedderWithRetry(server: any, maxRetries = 3): Promise<void> {
   for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
         // eslint-disable-next-line no-console
         console.log(`Warming embedder (attempt ${attempt}/${maxRetries})...`);

         const embedder = await warmEmbedder();

         // Update the server with the warmed embedder
         updateServerEmbedder(server, embedder);

         // eslint-disable-next-line no-console
         console.log('Embedder warmed successfully');

         return; // Success, exit retry loop
      } catch(error) {
         // eslint-disable-next-line no-console
         console.warn(`Embedder warming failed (attempt ${attempt}/${maxRetries}):`, error);

         if (attempt === maxRetries) {
            throw new Error(`Embedder warming failed after ${maxRetries} attempts: ${error}`);
         }

         // Wait before retry (exponential backoff)
         const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);

         // eslint-disable-next-line no-console
         console.log(`Retrying in ${delayMs}ms...`);

         await new Promise((resolve) => {
            setTimeout(resolve, delayMs);
         });
      }
   }
}

main().catch((error) => {
   // eslint-disable-next-line no-console
   console.error('Failed to start MCP server:', error);
   // eslint-disable-next-line no-process-exit
   process.exit(1);
});
