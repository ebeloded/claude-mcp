import { z } from "zod";
import { createErrorResponse, TaskNotFoundError } from "../utils/errors.js";
import { validateTaskId } from "../utils/validation.js";

/**
 * Status tool - Check task status and progress
 */
export const statusTool = {
  name: "status",
  description: "Get the current status of a running or completed task by ID.",
  schema: {
    taskId: z.string().describe("The task ID to check status for"),
  },
  handler: (claudeService, taskService) => async ({ taskId }) => {
    try {
      validateTaskId(taskId);
      const task = taskService.getTask(taskId);
      
      if (!task) {
        throw new TaskNotFoundError(taskId);
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
      return createErrorResponse(`Error checking task status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};