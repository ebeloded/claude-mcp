import { z } from "zod";

/**
 * Asynchronous Claude Code execution tool
 */
export function createAskAsyncTool(taskManager, claudeExecutor) {
  return {
    name: "ask_async",
    schema: {
      prompt: z.string().describe("The prompt to send to Claude Code"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID to resume a previous conversation"),
    },
    handler: async (args) => {
      const { prompt, sessionId } = args;
      try {
        const taskId = taskManager.createTask(prompt, sessionId);
        
        // Start execution in background
        claudeExecutor.executeAsync(taskManager, taskId, prompt, sessionId).catch(error => {
          console.error(`Async execution error for task ${taskId}:`, error);
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
  };
}