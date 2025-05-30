import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { logger } from "../utils/logger.js";
import { TaskNotFoundError } from "../utils/errors.js";

/**
 * Task Service for handling async agent operations
 * Improved version of TaskManager with better separation of concerns
 */
export class TaskService {
  constructor() {
    this.activeTasks = new Map();
    this.completedTasks = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // 5 minutes
    this.server = null; // Will be set later for MCP notifications
    
    logger.debugLog('TaskService initialized');
  }

  /**
   * Set the MCP server instance for sending notifications
   */
  setServer(server) {
    this.server = server;
    logger.debugLog('TaskService: MCP server instance set for notifications');
  }

  /**
   * Create a new task
   */
  createTask(prompt, previousResponseId = null, workingDirectory = null) {
    const taskId = randomUUID();
    const task = {
      id: taskId,
      prompt,
      previousResponseId,
      workingDirectory,
      status: 'pending',
      result: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      process: null
    };
    
    this.activeTasks.set(taskId, task);
    logger.debugLog(`Created task ${taskId}`);
    
    // Send MCP notification for task creation
    this.sendMcpNotification('task/created', {
      taskId,
      prompt,
      previousResponseId,
      workingDirectory,
      createdAt: task.createdAt.toISOString()
    });
    
    return taskId;
  }

  /**
   * Get task by ID
   */
  getTask(taskId) {
    const task = this.activeTasks.get(taskId) || this.completedTasks.get(taskId);
    if (!task) {
      logger.debugLog(`Task ${taskId} not found`);
    }
    return task;
  }

  /**
   * Get task by ID with validation
   */
  getTaskOrThrow(taskId) {
    const task = this.getTask(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }
    return task;
  }

  /**
   * Update task with new properties
   */
  updateTask(taskId, updates) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      const oldStatus = task.status;
      Object.assign(task, updates, { updatedAt: new Date() });
      
      logger.debugLog(`Updated task ${taskId}: ${oldStatus} -> ${task.status}`);
      
      // Send MCP notification for status updates
      this.sendMcpNotification('task/updated', {
        taskId,
        status: task.status,
        previousStatus: oldStatus,
        updatedAt: task.updatedAt.toISOString(),
        ...(task.result && { result: task.result }),
        ...(task.error && { error: task.error })
      });
      
      // Move to completed if finished
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
        this.activeTasks.delete(taskId);
        this.completedTasks.set(taskId, task);
        logger.debugLog(`Moved task ${taskId} to completed tasks`);
        
        // Send system notification when task completes (if enabled)
        this.sendNotification(taskId, task.status);
        
        // Send MCP completion notification
        this.sendMcpNotification('task/completed', {
          taskId,
          status: task.status,
          ...(task.result && { 
            result: task.result.result,
            responseId: task.result.session_id,
            cost: task.result.cost_usd,
            duration: task.result.duration_ms
          }),
          ...(task.error && { error: task.error }),
          completedAt: task.updatedAt.toISOString()
        });
      }
    } else {
      logger.warn(`Attempted to update non-existent task ${taskId}`);
    }
  }

  /**
   * Cancel a running task
   */
  cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task && task.process) {
      logger.debugLog(`Cancelling task ${taskId}`);
      task.process.kill('SIGTERM');
      this.updateTask(taskId, { status: 'cancelled' });
      
      // Send MCP notification for cancellation
      this.sendMcpNotification('task/cancelled', {
        taskId,
        cancelledAt: new Date().toISOString()
      });
      
      return true;
    }
    logger.debugLog(`Cannot cancel task ${taskId} - not found or no process`);
    return false;
  }

  /**
   * Get task statistics
   */
  getStats() {
    return {
      active: this.activeTasks.size,
      completed: this.completedTasks.size,
      total: this.activeTasks.size + this.completedTasks.size
    };
  }

  /**
   * Clean up old completed tasks
   */
  cleanup() {
    const cutoff = new Date(Date.now() - 3600000); // 1 hour ago
    let cleanedCount = 0;
    
    for (const [taskId, task] of this.completedTasks.entries()) {
      if (task.updatedAt < cutoff) {
        this.completedTasks.delete(taskId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debugLog(`Cleaned up ${cleanedCount} old tasks`);
    }
  }

  /**
   * Send MCP notification to client
   */
  sendMcpNotification(method, params) {
    if (!this.server) {
      logger.debugLog('Cannot send MCP notification: server not set');
      return;
    }

    try {
      // Check if server has notification capability
      if (typeof this.server.notification === 'function') {
        this.server.notification(method, params);
      } else if (typeof this.server.sendNotification === 'function') {
        this.server.sendNotification({ method, params });
      } else {
        logger.debugLog(`MCP server does not support notifications - method: ${method}`, params);
        return;
      }
      
      logger.debugLog(`Sent MCP notification: ${method}`, params);
    } catch (error) {
      logger.warn(`Failed to send MCP notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send system notification when task completes
   */
  sendNotification(taskId, status) {
    // Skip notifications if disabled
    if (process.env.MCP_NOTIFICATIONS === 'false') {
      return;
    }

    try {
      const task = this.getTask(taskId);
      if (!task) {
        logger.debugLog(`Cannot send notification: task ${taskId} not found`);
        return;
      }

      let message, sound;
      
      switch (status) {
        case 'completed':
          // Show preview of the agent's response
          message = task.result?.result
            ? (task.result.result.length > 60 
                ? task.result.result.substring(0, 60) + '...'
                : task.result.result)
            : 'Task completed';
          sound = '/System/Library/Sounds/Glass.aiff';
          break;
        case 'failed':
          message = task.error
            ? (task.error.length > 60
                ? task.error.substring(0, 60) + '...'
                : task.error)
            : 'Task failed';
          sound = '/System/Library/Sounds/Basso.aiff';
          break;
        case 'cancelled':
          message = `Task cancelled`;
          sound = '/System/Library/Sounds/Funk.aiff';
          break;
        default:
          return;
      }

      // macOS system notification
      if (process.platform === 'darwin') {
        // Escape quotes and special characters for AppleScript
        const escapedMessage = message.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, ' ');
        const notificationScript = `display notification "${escapedMessage}" with title "Claude Agent"`;
        logger.debugLog(`Attempting to show notification: ${escapedMessage}`);
        
        const notifProcess = spawn('osascript', ['-e', notificationScript], { stdio: 'pipe' });
        notifProcess.on('error', (err) => {
          logger.debugLog(`Notification error: ${err.message}`);
        });
        
        // Play sound
        spawn('afplay', [sound], { stdio: 'ignore' });
      }
      
      logger.debugLog(`Sent notification for task ${taskId}: ${status}`);
    } catch (error) {
      logger.debugLog(`Failed to send notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Destroy service and cancel all tasks
   */
  destroy() {
    logger.debugLog('Destroying TaskService');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Cancel all active tasks
    const activeTasks = Array.from(this.activeTasks.keys());
    for (const taskId of activeTasks) {
      this.cancelTask(taskId);
    }
    
    logger.debugLog(`TaskService destroyed. Cancelled ${activeTasks.length} active tasks`);
  }
}