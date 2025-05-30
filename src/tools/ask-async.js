import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Ask Async tool - Asynchronous agent execution
 */
export const askAsyncTool = {
  name: "ask_async",
  schema: {
    prompt: z.string().describe("The prompt to send to the agent. For long-running async tasks: (1) Define clear scope and boundaries, (2) Specify expected deliverables and format, (3) Mention file paths and directories to analyze, (4) Include constraints (focus areas, priorities), (5) Request progress indicators when possible. Example: 'Analyze all React components in src/components/ for accessibility issues, generate a detailed WCAG compliance report with specific line numbers and suggested fixes for each violation'"),
    workingDirectory: z
      .string()
      .optional()
      .describe("Optional working directory to execute the agent from. Use absolute paths or relative to current directory. Useful for working with different projects, git worktrees, or specific subdirectories."),
  },
  handler: (claudeService, taskService) => async ({ prompt, workingDirectory }) => {
    try {
      const taskId = taskService.createTask(prompt, undefined, workingDirectory);
      
      // Start execution in background
      claudeService.executeAsync(taskService, taskId, prompt, undefined, workingDirectory).catch(error => {
        logger.error(`Async execution error for task ${taskId}:`, error);
      });

      return createSuccessResponse(`Task started successfully. Use ask_status with task ID: ${taskId}`);
    } catch (error) {
      return createErrorResponse(`Error starting async task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};