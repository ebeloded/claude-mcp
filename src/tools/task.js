import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Task tool - Agent execution (sync or async)
 */
export const taskTool = {
  name: "task",
  schema: {
    prompt: z.string().describe("The prompt to send to the agent. For effective results: (1) Be specific about what you want, (2) Mention specific file paths or directories, (3) Specify desired output format (bullet points, JSON, etc.), (4) Include constraints or focus areas (performance, security, etc.). Example: 'Analyze the authentication logic in src/auth.js and list security vulnerabilities as bullet points, focusing on input validation and session management'"),
    workingDirectory: z
      .string()
      .optional()
      .describe("Optional working directory to execute the agent from. Use absolute paths or relative to current directory. Useful for working with different projects, git worktrees, or specific subdirectories."),
    async: z.boolean().optional().default(false).describe("Whether to execute the task asynchronously. When true, returns a task ID immediately and runs in background. When false (default), returns result synchronously."),
  },
  handler: (claudeService, taskService) => async ({ prompt, workingDirectory, async }) => {
    try {
      if (async) {
        // Async execution - start background task
        const taskId = taskService.createTask(prompt, undefined, workingDirectory);
        
        // Start execution in background
        claudeService.executeAsync(taskService, taskId, prompt, undefined, workingDirectory).catch(error => {
          logger.error(`Async execution error for task ${taskId}:`, error);
        });

        return createSuccessResponse(`Task started successfully. Use status with task ID: ${taskId}`);
      } else {
        // Sync execution - return result immediately
        const result = await claudeService.executeSync(prompt, undefined, workingDirectory);
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