import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/errors.js";
import { validateTaskId } from "../utils/validation.js";

/**
 * Cancel tool - Cancel running task
 */
export const cancelTool = {
  name: "cancel",
  description: "Cancel a running task by ID.",
  schema: {
    taskId: z.string().describe("The task ID to cancel"),
  },
  handler: (claudeService, taskService) => async ({ taskId }) => {
    try {
      validateTaskId(taskId);
      const success = taskService.cancelTask(taskId);
      
      const message = success 
        ? `Task ${taskId} cancelled successfully` 
        : `Task ${taskId} could not be cancelled (may not exist or already completed)`;
        
      return createSuccessResponse(message);
    } catch (error) {
      return createErrorResponse(`Error cancelling task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};