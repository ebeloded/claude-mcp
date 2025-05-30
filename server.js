#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import our modules
import { TaskManager } from "./src/managers/TaskManager.js";
import { ClaudeExecutor } from "./src/executors/ClaudeExecutor.js";

// Create an MCP server
const server = new McpServer({
  name: "Claude Code MCP Server",
  version: "2.0.0",
});

// Debug flag
const DEBUG = process.env.MCP_CLAUDE_DEBUG === "true";

// Initialize managers and executors
const taskManager = new TaskManager();
const claudeExecutor = new ClaudeExecutor(DEBUG);

// Register tools using the correct MCP SDK pattern
server.tool(
  "ask",
  {
    prompt: z.string().describe("The prompt to send to Claude Code"),
    workingDirectory: z
      .string()
      .optional()
      .describe("Optional working directory to execute Claude Code from. Defaults to current directory if not specified."),
  },
  async ({ prompt, workingDirectory }) => {
    try {
      const result = await claudeExecutor.executeSync(prompt, undefined, workingDirectory);
      return {
        content: [
          {
            type: "text",
            text: `${result.result}\n\nResponse ID: ${result.session_id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "ask_async",
  {
    prompt: z.string().describe("The prompt to send to Claude Code"),
    workingDirectory: z
      .string()
      .optional()
      .describe("Optional working directory to execute Claude Code from. Defaults to current directory if not specified."),
  },
  async ({ prompt, workingDirectory }) => {
    try {
      const taskId = taskManager.createTask(prompt, undefined, workingDirectory);
      
      // Start execution in background
      claudeExecutor.executeAsync(taskManager, taskId, prompt, undefined, workingDirectory).catch(error => {
        if (DEBUG) console.error(`Async execution error for task ${taskId}:`, error);
      });

      return {
        content: [
          {
            type: "text",
            text: `Task started successfully. Use ask_status with task ID: ${taskId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error starting async task: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "resume",
  {
    prompt: z.string().describe("The prompt to send to Claude Code"),
    previousResponseId: z
      .string()
      .describe("Response ID to continue from a previous Claude response"),
  },
  async ({ prompt, previousResponseId }) => {
    try {
      const result = await claudeExecutor.executeSync(prompt, previousResponseId, undefined);
      return {
        content: [
          {
            type: "text",
            text: `${result.result}\n\nResponse ID: ${result.session_id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "resume_async",
  {
    prompt: z.string().describe("The prompt to send to Claude Code"),
    previousResponseId: z
      .string()
      .describe("Response ID to continue from a previous Claude response"),
  },
  async ({ prompt, previousResponseId }) => {
    try {
      const taskId = taskManager.createTask(prompt, previousResponseId, undefined);
      
      // Start execution in background
      claudeExecutor.executeAsync(taskManager, taskId, prompt, previousResponseId, undefined).catch(error => {
        if (DEBUG) console.error(`Async execution error for task ${taskId}:`, error);
      });

      return {
        content: [
          {
            type: "text",
            text: `Task started successfully. Use ask_status with task ID: ${taskId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error starting async task: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "ask_status",
  {
    taskId: z.string().describe("The task ID to check status for"),
  },
  async ({ taskId }) => {
    try {
      const task = taskManager.getTask(taskId);
      
      if (!task) {
        return {
          content: [
            {
              type: "text",
              text: `Task ${taskId} not found`,
            },
          ],
          isError: true,
        };
      }

      let statusText = `Task ${taskId}:\n`;
      statusText += `Status: ${task.status}\n`;
      
      // Calculate elapsed time
      const now = new Date();
      const elapsedMs = now.getTime() - task.createdAt.getTime();
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const elapsedTime = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      
      statusText += `Elapsed: ${elapsedTime}\n`;
      statusText += `Working Directory: ${task.workingDirectory || process.cwd()}\n`;
      statusText += `Created: ${task.createdAt.toISOString()}\n`;
      statusText += `Updated: ${task.updatedAt.toISOString()}\n`;

      if (task.status === 'completed' && task.result) {
        statusText += `\nResult: ${task.result.result}\n`;
        statusText += `Response ID: ${task.result.session_id}\n`;
        statusText += `Cost: $${task.result.cost_usd}\n`;
        statusText += `Duration: ${task.result.duration_ms}ms`;
      } else if (task.status === 'failed' && task.error) {
        statusText += `\nError: ${task.error}`;
      }

      return {
        content: [
          {
            type: "text",
            text: statusText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error checking task status: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "ask_cancel",
  {
    taskId: z.string().describe("The task ID to cancel"),
  },
  async ({ taskId }) => {
    try {
      const success = taskManager.cancelTask(taskId);
      
      return {
        content: [
          {
            type: "text",
            text: success 
              ? `Task ${taskId} cancelled successfully` 
              : `Task ${taskId} could not be cancelled (may not exist or already completed)`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error cancelling task: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start the server over stdio
const transport = new StdioServerTransport();

// Cleanup on exit
process.on('SIGINT', () => {
  if (DEBUG) console.error('[DEBUG] Received SIGINT, cleaning up...');
  taskManager.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (DEBUG) console.error('[DEBUG] Received SIGTERM, cleaning up...');
  taskManager.destroy();
  process.exit(0);
});

async function main() {
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  taskManager.destroy();
  process.exit(1);
});