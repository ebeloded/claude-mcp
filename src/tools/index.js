/**
 * MCP Tools Registry
 * Exports all available tools for the MCP server
 */

import { startTool } from "./start.js"
import { resumeTool } from "./resume.js"
import { statusTool } from "./status.js"
import { cancelTool } from "./cancel.js"

/**
 * All available MCP tools
 */
export const tools = [startTool, resumeTool, statusTool, cancelTool]

/**
 * Register all tools with the MCP server
 */
export function registerTools(server, claudeService, taskService) {
  for (const tool of tools) {
    // Prefer signature with description to satisfy SDK requirements
    if (tool.description) {
      server.tool(
        tool.name,
        tool.description,
        tool.schema,
        tool.handler(claudeService, taskService)
      )
    } else {
      // Fallback for backward compatibility
      server.tool(
        tool.name,
        tool.schema,
        tool.handler(claudeService, taskService)
      )
    }
  }
}
