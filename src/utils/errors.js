/**
 * Error handling utilities for consistent error responses
 */

/**
 * Create standardized error response for MCP tools
 */
export function createErrorResponse(error) {
  return {
    content: [
      {
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}

/**
 * Create standardized success response for MCP tools
 */
export function createSuccessResponse(text) {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

/**
 * Custom error classes for better error handling
 */
export class TaskNotFoundError extends Error {
  constructor(taskId) {
    super(`Task ${taskId} not found`);
    this.name = "TaskNotFoundError";
    this.taskId = taskId;
  }
}

export class ExecutionError extends Error {
  constructor(message, exitCode = null) {
    super(message);
    this.name = "ExecutionError";
    this.exitCode = exitCode;
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}