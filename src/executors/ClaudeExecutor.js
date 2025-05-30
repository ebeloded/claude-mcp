import { spawn } from "child_process";
import { existsSync, accessSync, constants } from "fs";
import { join, resolve, relative } from "path";
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
   * Validate and resolve working directory
   */
  validateWorkingDirectory(workingDirectory) {
    if (!workingDirectory) {
      return process.cwd();
    }

    // Resolve relative paths
    const resolvedPath = resolve(workingDirectory);
    
    // Security check: prevent directory traversal attacks
    const relativePath = relative(process.cwd(), resolvedPath);
    if (relativePath.startsWith('..') && !resolvedPath.startsWith(process.cwd())) {
      this.debugLog(`Working directory security check: ${resolvedPath} is outside current directory tree`);
      // Allow absolute paths, but log for security awareness
    }

    // Check if directory exists
    if (!existsSync(resolvedPath)) {
      throw new Error(`Working directory does not exist: ${resolvedPath}`);
    }

    // Check if directory is accessible
    try {
      accessSync(resolvedPath, constants.R_OK);
    } catch (error) {
      throw new Error(`Working directory is not accessible: ${resolvedPath}`);
    }

    this.debugLog(`Using working directory: ${resolvedPath}`);
    return resolvedPath;
  }

  /**
   * Execute Claude Code synchronously
   */
  async executeSync(prompt, previousResponseId, workingDirectory) {
    return new Promise((resolve, reject) => {
      const claudePath = this.findClaudeCli();
      
      const args = ["-p", prompt, "--output-format", "json"];

      // Add conversation resumption if previousResponseId provided
      if (previousResponseId) {
        args.push("--resume", previousResponseId);
      }

      // Skip permissions for now (dangerous but functional)
      args.push("--dangerously-skip-permissions");

      this.debugLog(`Executing: ${claudePath} ${args.join(" ")}`);
      
      // Add timeout to prevent hanging (30 minutes like the reference)
      const timeout = setTimeout(() => {
        this.debugLog("Claude Code execution timed out");
        reject(new Error("Claude Code execution timed out after 30 minutes"));
      }, 30 * 60 * 1000);

      const cwd = this.validateWorkingDirectory(workingDirectory);
      
      const claudeProcess = spawn(claudePath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        cwd: cwd
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
            // First try to parse as JSON
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            // If JSON parsing fails, treat as plain text response
            // Create a structured response that matches expected format
            this.debugLog(`Response is plain text, not JSON: ${stdout}`);
            
            // Extract response ID from stderr if available (Claude Code might output it there)
            const responseIdMatch = stderr.match(/Response ID: ([a-f0-9-]+)/);
            const responseId = responseIdMatch ? responseIdMatch[1] : null;
            
            resolve({
              type: "result",
              subtype: "success",
              session_id: responseId,
              result: stdout.trim(),
              is_error: false,
              cost_usd: 0,
              duration_ms: 0
            });
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
  async executeAsync(taskManager, taskId, prompt, previousResponseId, workingDirectory) {
    const task = taskManager.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    taskManager.updateTask(taskId, { status: 'running' });

    const claudePath = this.findClaudeCli();
    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];

    if (previousResponseId) {
      args.push("--resume", previousResponseId);
    }

    args.push("--dangerously-skip-permissions");

    this.debugLog(`Executing async: ${claudePath} ${args.join(" ")}`);

    const cwd = this.validateWorkingDirectory(workingDirectory);
    
    const claudeProcess = spawn(claudePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      cwd: cwd
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
            // Progress update removed - we can't accurately measure Claude Code progress
          } else if (message.type === 'assistant' || message.type === 'user') {
            // Progress tracking removed - we don't have reliable progress info
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
          let result = lastResult;
          if (!result) {
            const lines = stdout.trim().split('\n').filter(line => line.trim());
            const lastLine = lines.pop();
            if (!lastLine) {
              throw new Error('No valid output lines found');
            }
            try {
              result = JSON.parse(lastLine);
            } catch (parseError) {
              // If JSON parsing fails, treat as plain text response
              this.debugLog(`Async response is plain text, not JSON: ${stdout}`);
              
              // Extract response ID from stderr if available
              const responseIdMatch = stderr.match(/Response ID: ([a-f0-9-]+)/);
              const responseId = responseIdMatch ? responseIdMatch[1] : null;
              
              result = {
                type: "result",
                subtype: "success",
                session_id: responseId,
                result: stdout.trim(),
                is_error: false,
                cost_usd: 0,
                duration_ms: 0
              };
            }
          }
          taskManager.updateTask(taskId, { 
            status: 'completed', 
            result,
            process: null 
          });
        } catch (error) {
          taskManager.updateTask(taskId, { 
            status: 'failed', 
            error: `Failed to parse Claude response: ${error instanceof Error ? error.message : String(error)}\nOutput: ${stdout}`,
            process: null
          });
        }
      } else {
        taskManager.updateTask(taskId, { 
          status: 'failed', 
          error: `Claude Code failed with exit code ${code}: ${stderr}`,
          process: null
        });
      }
    });

    claudeProcess.on("error", (error) => {
      this.debugLog(`Async process error: ${error.message}`);
      taskManager.updateTask(taskId, { 
        status: 'failed', 
        error: `Failed to spawn Claude Code process: ${error.message}`,
        process: null
      });
    });
  }
}