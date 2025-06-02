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
    this.parentCheckInterval = setInterval(() => this.checkParentProcess(), 1000); // Check every second
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
  createTask(message, previousResponseId = null, workingDirectory = null) {
    const taskId = randomUUID();
    const task = {
      id: taskId,
      message,
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
      message,
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
      
      try {
        // Kill the entire process group
        process.kill(-task.process.pid, 'SIGTERM');
        logger.debugLog(`Sent SIGTERM to process group ${task.process.pid}`);
      } catch (error) {
        // Fallback to killing just the process if process group kill fails
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.debugLog(`Process group kill failed, fallback to single process: ${errorMessage}`);
        task.process.kill('SIGTERM');
      }
      
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
   * Send task started notification
   */
  sendTaskStartedNotification(taskId, message, workingDirectory) {
    logger.debugLog(`Sending task started notification for ${taskId}`);
    
    // Send MCP notification (even though it's not supported, for logging)
    this.sendMcpNotification('task/started', {
      taskId,
      message: message.length > 100 ? message.substring(0, 100) + '...' : message,
      workingDirectory,
      startedAt: new Date().toISOString()
    });
    
    // Send system notification for task start
    this.sendSystemNotificationForStart(taskId, message);
  }

  /**
   * Send system notification for task start
   * @param {string} taskId
   * @param {string} message
   */
  sendSystemNotificationForStart(taskId, message) {
    // Skip notifications if disabled
    if (process.env.MCP_NOTIFICATIONS === 'false') {
      return;
    }

    try {
      const notificationMessage = `Started: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`;
      
      // macOS system notification
      if (process.platform === 'darwin') {
        // Escape quotes and special characters for AppleScript
        const escapedMessage = notificationMessage.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, ' ');
        const notificationScript = `display notification "${escapedMessage}" with title "Agent Task Started"`;
        logger.debugLog(`Attempting to show start notification: ${escapedMessage}`);
        
        const notifProcess = spawn('osascript', ['-e', notificationScript], { stdio: 'pipe' });
        notifProcess.on('error', (err) => {
          logger.debugLog(`Start notification error: ${err.message}`);
        });
        
        // Play a subtle start sound
        spawn('afplay', ['/System/Library/Sounds/Tink.aiff'], { stdio: 'ignore' });
      }
      
      logger.debugLog(`Sent start notification for task ${taskId}`);
    } catch (error) {
      logger.debugLog(`Failed to send start notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send MCP notification to client
   * @param {string} method
   * @param {any} params
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
   * @param {string} taskId
   * @param {string} status
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
        const notificationScript = `display notification "${escapedMessage}" with title "Agent Task Completed"`;
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
   * Check if parent process is still alive
   */
  checkParentProcess() {
    try {
      const ppid = process.ppid;
      if (ppid <= 1) {
        logger.info('Parent process no longer exists, shutting down...');
        this.shutdownDueToParentExit('Parent process no longer exists');
        return;
      }
      
      // Try to signal parent process to check if it exists
      process.kill(ppid, 0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.info('Parent process check failed, shutting down...', errorMessage);
      this.shutdownDueToParentExit(`Parent process check failed: ${errorMessage}`);
    }
  }

  /**
   * Shutdown due to parent process exit - notify about each task
   * @param {string} reason
   */
  shutdownDueToParentExit(reason) {
    logger.info(`Shutting down due to parent exit: ${reason}`);
    
    // Send notifications for each active task before cancelling
    const activeTasks = Array.from(this.activeTasks.keys());
    for (const taskId of activeTasks) {
      this.sendMcpNotification('task/cancelled', {
        taskId,
        reason: 'parent_process_exit',
        details: reason,
        cancelledAt: new Date().toISOString()
      });
      
      // Cancel the task
      const task = this.activeTasks.get(taskId);
      if (task && task.process) {
        try {
          process.kill(-task.process.pid, 'SIGTERM');
          logger.debugLog(`Sent SIGTERM to process group ${task.process.pid} due to parent exit`);
        } catch (killError) {
          task.process.kill('SIGTERM');
        }
      }
      
      this.updateTask(taskId, { status: 'cancelled' });
    }
    
    this.destroy();
    process.exit(0);
  }

  /**
   * Destroy service and cancel all tasks
   */
  destroy() {
    logger.debugLog('Destroying TaskService');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.parentCheckInterval) {
      clearInterval(this.parentCheckInterval);
    }
    
    // Cancel all active tasks
    const activeTasks = Array.from(this.activeTasks.keys());
    for (const taskId of activeTasks) {
      this.cancelTask(taskId);
    }
    
    logger.debugLog(`TaskService destroyed. Cancelled ${activeTasks.length} active tasks`);
  }
}