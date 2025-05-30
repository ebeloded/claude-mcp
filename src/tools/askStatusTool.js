import { z } from "zod";

/**
 * Check status of async task
 */
export function createAskStatusTool(taskManager) {
  return {
    name: "ask_status",
    schema: {
      taskId: z.string().describe("The task ID to check status for"),
    },
    handler: async (args) => {
      const { taskId } = args;
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
        statusText += `Progress: ${task.progress}%\n`;
        statusText += `Created: ${task.createdAt.toISOString()}\n`;
        statusText += `Updated: ${task.updatedAt.toISOString()}\n`;

        if (task.status === 'completed' && task.result) {
          statusText += `\nResult: ${task.result.result}\n`;
          statusText += `Session ID: ${task.result.session_id}\n`;
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
  };
}