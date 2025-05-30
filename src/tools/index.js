/**
 * MCP Tools Registry
 * Exports all available tools for the MCP server
 */

import { askTool } from "./ask.js";
import { askAsyncTool } from "./ask-async.js";
import { resumeTool } from "./resume.js";
import { resumeAsyncTool } from "./resume-async.js";
import { statusTool } from "./status.js";
import { cancelTool } from "./cancel.js";

/**
 * All available MCP tools
 */
export const tools = [
  askTool,
  askAsyncTool,
  resumeTool,
  resumeAsyncTool,
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