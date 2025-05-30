import { z } from "zod";

/**
 * Cancel async task
 */
export function createAskCancelTool(taskManager) {
  return {
    name: "ask_cancel",
    schema: {
      taskId: z.string().describe("The task ID to cancel"),
    },
    handler: async (args) => {
      const { taskId } = args;
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
  };
}