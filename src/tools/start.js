import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Start tool - Agent execution (sync or async)
 */
export const startTool = {
  name: "start",
  schema: {
    message: z.string().describe("The message to send to the agent. For effective results: (1) Be specific about what you want, (2) Mention specific file paths or directories, (3) Specify desired output format (bullet points, JSON, etc.), (4) Include constraints or focus areas (performance, security, etc.), (5) Use @-mention syntax to include file contents directly (e.g., '@package.json' or '@src/auth.js') - this automatically reads and includes the file without requiring separate tool calls. Example: 'Analyze the authentication logic in @src/auth.js and list security vulnerabilities as bullet points, focusing on input validation and session management'"),
    workingDirectory: z
      .string()
      .optional()
      .describe("Optional working directory to execute the agent from. Use absolute paths or relative to current directory. Useful for working with different projects, git worktrees, or specific subdirectories."),
    systemPrompt: z
      .string()
      .optional()
      .describe("Optional system prompt to override the default behavior. This completely replaces the default system prompt."),
    appendSystemPrompt: z
      .string()
      .optional()
      .describe("Optional text to append to the default system prompt. This is added after the default system prompt."),
    async: z.boolean().optional().default(true).describe("Whether to execute the task asynchronously. When true (default), returns a task ID immediately and runs in background. When false, returns result synchronously."),
  },
  handler: (claudeService, taskService) => async ({ message, workingDirectory, systemPrompt, appendSystemPrompt, async }) => {
    try {
      // Prepare options object with optional parameters
      const options = {};
      if (systemPrompt) options.systemPrompt = systemPrompt;
      if (appendSystemPrompt) options.appendSystemPrompt = appendSystemPrompt;
      
      if (async) {
        // Async execution - start background task
        const taskId = taskService.createTask(message, undefined, workingDirectory, options);
        
        // Start execution in background
        claudeService.executeAsync(taskService, taskId, message, undefined, workingDirectory, options).catch(error => {
          logger.error(`Async execution error for task ${taskId}:`, error);
        });

        return createSuccessResponse(`Task started successfully. Use status with task ID: ${taskId}`);
      } else {
        // Sync execution - return result immediately
        const result = await claudeService.executeSync(message, undefined, workingDirectory, options);
        return {
          content: [
            {
              type: "text",
              text: `${result.result}\n\nResponse ID: ${result.session_id}`,
            },
          ],
        };
      }
    } catch (error) {
      return createErrorResponse(error);
    }
  }
};