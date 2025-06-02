/**
 * MCP Tools Registry
 * Exports all available tools for the MCP server
 */

import { startTool } from "./start.js";
import { continueTool } from "./continue.js";
import { statusTool } from "./status.js";
import { cancelTool } from "./cancel.js";

/**
 * All available MCP tools
 */
export const tools = [
  startTool,
  continueTool,
  statusTool,
  cancelTool
];

/**
 * Register all tools with the MCP server
 */
export function registerTools(server, claudeService, taskService) {
  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.schema,
      tool.handler(claudeService, taskService)
    );
  }
}