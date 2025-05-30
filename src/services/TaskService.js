import { randomUUID } from "crypto";
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