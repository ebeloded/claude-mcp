import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Resume Async tool - Continue conversation asynchronously
 */
export const resumeAsyncTool = {
  name: "resume_async",
  schema: {
    prompt: z.string().describe("The prompt to send to the agent for long-running continuation tasks. Building on conversation context: (1) Reference previous analysis or work clearly, (2) Specify what to extend or continue, (3) Define scope for the additional work, (4) Request specific deliverables and format, (5) Mention if this builds on previous findings. Example: 'Continue that security analysis by implementing the fixes you suggested, providing complete code changes for each vulnerability with detailed comments explaining the security improvements'"),
    previousResponseId: z
      .string()
      .describe("Response ID to continue from a previous agent response. Use the Response ID from any previous ask/resume call to branch or continue that conversation."),
  },
  handler: (claudeService, taskService) => async ({ prompt, previousResponseId }) => {
    try {
      const taskId = taskService.createTask(prompt, previousResponseId, undefined);
      
      // Start execution in background
      claudeService.executeAsync(taskService, taskId, prompt, previousResponseId, undefined).catch(error => {
        logger.error(`Async execution error for task ${taskId}:`, error);
      });

      return createSuccessResponse(`Task started successfully. Use ask_status with task ID: ${taskId}`);
    } catch (error) {
      return createErrorResponse(`Error starting async task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};