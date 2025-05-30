import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Continue tool - Continue conversation (sync or async)
 */
export const continueTool = {
  name: "continue",
  schema: {
    prompt: z.string().describe("The prompt to send to the agent to continue a conversation. Since the agent remembers context: (1) Reference previous responses naturally ('that function', 'the code you analyzed'), (2) Build incrementally ('now add...', 'what about...'), (3) Ask follow-up questions, (4) Request modifications or extensions, (5) Use @-mention syntax to include additional file/directory contents (e.g., '@config/settings.js' or '@tests/') for context. Example: 'Now add comprehensive error handling to that authentication function, also review @config/database.js for connection handling patterns'"),
    previousResponseId: z
      .string()
      .describe("Response ID to continue from a previous agent response. Use the Response ID from any previous task/continue call to branch or continue that conversation."),
    async: z.boolean().optional().default(false).describe("Whether to execute the task asynchronously. When true, returns a task ID immediately and runs in background. When false (default), returns result synchronously."),
  },
  handler: (claudeService, taskService) => async ({ prompt, previousResponseId, async }) => {
    try {
      if (async) {
        // Async execution - start background task
        const taskId = taskService.createTask(prompt, previousResponseId, undefined);
        
        // Start execution in background
        claudeService.executeAsync(taskService, taskId, prompt, previousResponseId, undefined).catch(error => {
          logger.error(`Async execution error for task ${taskId}:`, error);
        });

        return createSuccessResponse(`Task started successfully. Use status with task ID: ${taskId}`);
      } else {
        // Sync execution - return result immediately
        const result = await claudeService.executeSync(prompt, previousResponseId, undefined);
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