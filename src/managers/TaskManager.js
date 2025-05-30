import { randomUUID } from "crypto";

/**
 * Task Manager for handling async Claude Code operations
 */
export class TaskManager {
  constructor() {
    this.activeTasks = new Map();
    this.completedTasks = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // 5 minutes
  }

  /**
   * Create a new task
   */
  createTask(prompt, previousResponseId, workingDirectory) {
    const taskId = randomUUID();
    const task = {
      id: taskId,
      prompt,
      previousResponseId,
      workingDirectory,
      status: 'pending',
      progress: 0,
      result: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      process: null
    };
    
    this.activeTasks.set(taskId, task);
    return taskId;
  }

  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.activeTasks.get(taskId) || this.completedTasks.get(taskId);
  }

  /**
   * Update task with new properties
   */
  updateTask(taskId, updates) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      Object.assign(task, updates, { updatedAt: new Date() });
      
      // Move to completed if finished
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
        this.activeTasks.delete(taskId);
        this.completedTasks.set(taskId, task);
      }
    }
  }

  /**
   * Cancel a running task
   */
  cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task && task.process) {
      task.process.kill('SIGTERM');
      this.updateTask(taskId, { status: 'cancelled' });
      return true;
    }
    return false;
  }

  /**
   * Clean up old completed tasks
   */
  cleanup() {
    const cutoff = new Date(Date.now() - 3600000); // 1 hour ago
    for (const [taskId, task] of this.completedTasks.entries()) {
      if (task.updatedAt < cutoff) {
        this.completedTasks.delete(taskId);
      }
    }
  }

  /**
   * Destroy manager and cancel all tasks
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Cancel all active tasks
    for (const taskId of this.activeTasks.keys()) {
      this.cancelTask(taskId);
    }
  }
}