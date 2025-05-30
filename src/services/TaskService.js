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
    
    logger.debugLog('TaskService initialized');
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
      
      // Move to completed if finished
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
        this.activeTasks.delete(taskId);
        this.completedTasks.set(taskId, task);
        logger.debugLog(`Moved task ${taskId} to completed tasks`);
        
        // Send notification when task completes
        this.sendNotification(taskId, task.status);
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
   * Send system notification when task completes
   */
  sendNotification(taskId, status) {
    // Skip notifications if disabled
    if (process.env.MCP_NOTIFICATIONS === 'false') {
      return;
    }

    try {
      const shortId = taskId.slice(0, 8);
      let message, sound;
      
      switch (status) {
        case 'completed':
          message = `Task ${shortId} completed successfully`;
          sound = '/System/Library/Sounds/Glass.aiff';
          break;
        case 'failed':
          message = `Task ${shortId} failed`;
          sound = '/System/Library/Sounds/Basso.aiff';
          break;
        case 'cancelled':
          message = `Task ${shortId} was cancelled`;
          sound = '/System/Library/Sounds/Funk.aiff';
          break;
        default:
          return;
      }

      // macOS system notification
      if (process.platform === 'darwin') {
        const notificationScript = `display notification "${message}" with title "Claude MCP Agent"`;
        spawn('osascript', ['-e', notificationScript], { stdio: 'ignore' });
        
        // Play sound
        spawn('afplay', [sound], { stdio: 'ignore' });
      }
      
      logger.debugLog(`Sent notification for task ${taskId}: ${status}`);
    } catch (error) {
      logger.debugLog(`Failed to send notification: ${error.message}`);
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