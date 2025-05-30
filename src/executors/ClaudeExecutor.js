import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Claude Code execution utilities
 */
export class ClaudeExecutor {
  constructor(debug = false) {
    this.debug = debug;
  }

  debugLog(...args) {
    if (this.debug) {
      console.error("[DEBUG]", ...args);
    }
  }

  /**
   * Find Claude CLI binary
   */
  findClaudeCli() {
    const customCliName = process.env.CLAUDE_CLI_NAME || "claude";
    
    this.debugLog(`Looking for Claude CLI, custom name: ${customCliName}`);
    
    // Check if it's an absolute path
    if (customCliName.startsWith("/")) {
      this.debugLog(`Using absolute path: ${customCliName}`);
      return customCliName;
    }
    
    // For default "claude", check local installation first
    if (customCliName === "claude") {
      const userPath = join(homedir(), ".claude", "local", "claude");
      this.debugLog(`Checking local path: ${userPath}`);
      
      if (existsSync(userPath)) {
        this.debugLog(`Found local Claude CLI at: ${userPath}`);
        return userPath;
      }
    }
    
    // Fallback to PATH lookup
    this.debugLog(`Using PATH lookup for: ${customCliName}`);
    return customCliName;
  }

  /**
   * Execute Claude Code synchronously
   */
  async executeSync(prompt, sessionId) {
    return new Promise((resolve, reject) => {
      const claudePath = this.findClaudeCli();
      
      const args = ["-p", prompt, "--output-format", "json"];

      // Add session resumption if sessionId provided
      if (sessionId) {
        args.push("--resume", sessionId);
      }

      // Skip permissions for now (dangerous but functional)
      args.push("--dangerously-skip-permissions");

      this.debugLog(`Executing: ${claudePath} ${args.join(" ")}`);
      
      // Add timeout to prevent hanging (30 minutes like the reference)
      const timeout = setTimeout(() => {
        this.debugLog("Claude Code execution timed out");
        reject(new Error("Claude Code execution timed out after 30 minutes"));
      }, 30 * 60 * 1000);

      const claudeProcess = spawn(claudePath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false
      });

      let stdout = "";
      let stderr = "";

      claudeProcess.stdout?.on("data", (data) => {
        const chunk = data.toString();
        this.debugLog(`STDOUT: ${chunk}`);
        stdout += chunk;
      });

      claudeProcess.stderr?.on("data", (data) => {
        const chunk = data.toString();
        this.debugLog(`STDERR: ${chunk}`);
        stderr += chunk;
      });

      claudeProcess.on("close", (code) => {
        clearTimeout(timeout);
        this.debugLog(`Process closed with code: ${code}`);
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(
              new Error(
                `Failed to parse Claude response: ${
                  error instanceof Error ? error.message : String(error)
                }\nOutput: ${stdout}`
              )
            );
          }
        } else {
          reject(
            new Error(`Claude Code failed with exit code ${code}: ${stderr}`)
          );
        }
      });

      claudeProcess.on("error", (error) => {
        clearTimeout(timeout);
        this.debugLog(`Process error: ${error.message}`);
        reject(new Error(`Failed to spawn Claude Code process: ${error.message}`));
      });
    });
  }

  /**
   * Execute Claude Code asynchronously with progress tracking
   */
  async executeAsync(taskManager, taskId, prompt, sessionId) {
    const task = taskManager.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    taskManager.updateTask(taskId, { status: 'running', progress: 10 });

    const claudePath = this.findClaudeCli();
    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];

    if (sessionId) {
      args.push("--resume", sessionId);
    }

    args.push("--dangerously-skip-permissions");

    this.debugLog(`Executing async: ${claudePath} ${args.join(" ")}`);

    const claudeProcess = spawn(claudePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });

    // Store process for cancellation
    taskManager.updateTask(taskId, { process: claudeProcess });

    let stdout = "";
    let stderr = "";
    let lastResult = null;

    claudeProcess.stdout?.on("data", (data) => {
      const chunk = data.toString();
      this.debugLog(`ASYNC STDOUT: ${chunk}`);
      stdout += chunk;

      // Parse streaming JSON for progress updates
      const lines = chunk.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.type === 'result') {
            lastResult = message;
            taskManager.updateTask(taskId, { progress: 90 });
          } else if (message.type === 'assistant' || message.type === 'user') {
            const currentTask = taskManager.getTask(taskId);
            if (currentTask) {
              taskManager.updateTask(taskId, { progress: Math.min(currentTask.progress + 10, 80) });
            }
          }
        } catch (parseError) {
          // Ignore parse errors for partial JSON
        }
      }
    });

    claudeProcess.stderr?.on("data", (data) => {
      const chunk = data.toString();
      this.debugLog(`ASYNC STDERR: ${chunk}`);
      stderr += chunk;
    });

    claudeProcess.on("close", (code) => {
      this.debugLog(`Async process closed with code: ${code}`);
      
      if (code === 0) {
        try {
          // If we have a result from streaming, use it; otherwise parse the full output
          const result = lastResult || (() => {
            const lines = stdout.trim().split('\n').filter(line => line.trim());
            const lastLine = lines.pop();
            if (!lastLine) {
              throw new Error('No valid output lines found');
            }
            return JSON.parse(lastLine);
          })();
          taskManager.updateTask(taskId, { 
            status: 'completed', 
            progress: 100, 
            result,
            process: null 
          });
        } catch (error) {
          taskManager.updateTask(taskId, { 
            status: 'failed', 
            progress: 100,
            error: `Failed to parse Claude response: ${error instanceof Error ? error.message : String(error)}\nOutput: ${stdout}`,
            process: null
          });
        }
      } else {
        taskManager.updateTask(taskId, { 
          status: 'failed', 
          progress: 100,
          error: `Claude Code failed with exit code ${code}: ${stderr}`,
          process: null
        });
      }
    });

    claudeProcess.on("error", (error) => {
      this.debugLog(`Async process error: ${error.message}`);
      taskManager.updateTask(taskId, { 
        status: 'failed', 
        progress: 100,
        error: `Failed to spawn Claude Code process: ${error.message}`,
        process: null
      });
    });
  }
}