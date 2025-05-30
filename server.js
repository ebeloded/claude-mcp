#!/usr/bin/env node

/**
 * Claude Code MCP Server
 * Refactored for better maintainability and separation of concerns
 */

import { McpServerSetup } from "./src/server/setup.js";
import { logger } from "./src/utils/logger.js";

async function main() {
  try {
    // Initialize and start the server
    const serverSetup = new McpServerSetup();
    serverSetup.initialize();
    await serverSetup.start();
    
    // Log startup information
    const stats = serverSetup.getStats();
    logger.info(`${stats.server.name} v${stats.server.version} is running`);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();