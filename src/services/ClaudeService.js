import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { logger } from "../utils/logger.js";
import { ExecutionError } from "../utils/errors.js";
import { validateWorkingDirectory, validatePrompt } from "../utils/validation.js";

/**
 * Claude Service for executing agent operations
 * Improved version of ClaudeExecutor with better separation of concerns
 */
export class ClaudeService {
  constructor() {
    this.cliPath = this.findClaudeCli();
    logger.debugLog(`ClaudeService initialized with CLI path: ${this.cliPath}`);
  }

  /**
   * Find agent CLI binary
   */
  findClaudeCli() {
    const customCliName = process.env.CLAUDE_CLI_NAME || "claude";
    
    logger.debugLog(`Looking for agent CLI, custom name: ${customCliName}`);
    
    // Check if it's an absolute path
    if (customCliName.startsWith("/")) {
      logger.debugLog(`Using absolute path: ${customCliName}`);
      return customCliName;
    }
    
    // For default "claude", check local installation first
    if (customCliName === "claude") {
      const userPath = join(homedir(), ".claude", "local", "claude");
      logger.debugLog(`Checking local path: ${userPath}`);
      
      if (existsSync(userPath)) {
        logger.debugLog(`Found local agent CLI at: ${userPath}`);
        return userPath;
      }
    }
    
    // Fallback to PATH lookup
    logger.debugLog(`Using PATH lookup for: ${customCliName}`);
    return customCliName;
  }

  /**
   * Build command line arguments for Claude CLI
   */
  buildArgs(prompt, previousResponseId = null, isAsync = false) {
    validatePrompt(prompt);
    
    const args = ["-p", prompt];
    
    // Set output format based on execution type
    if (isAsync) {
      args.push("--output-format", "stream-json", "--verbose");
    } else {
      args.push("--output-format", "json");
    }

    // Add conversation resumption if previousResponseId provided
    if (previousResponseId) {
      args.push("--resume", previousResponseId);
    }

    // Skip permissions for now (dangerous but functional)
    args.push("--dangerously-skip-permissions");

    return args;
  }

  /**
   * Parse Claude CLI response
   */
  parseResponse(stdout, stderr, isPlainText = false) {
    if (isPlainText) {
      // Extract response ID from stderr if available
      const responseIdMatch = stderr.match(/Response ID: ([a-f0-9-]+)/);
      const responseId = responseIdMatch ? responseIdMatch[1] : null;
      
      return {
        type: "result",
        subtype: "success",
        session_id: responseId,
        result: stdout.trim(),
        is_error: false,
        cost_usd: 0,
        duration_ms: 0
      };
    }

    try {
      return JSON.parse(stdout);
    } catch (error) {
      // Fallback to plain text parsing
      return this.parseResponse(stdout, stderr, true);
    }
  }

  /**
   * Execute agent synchronously
   */
  async executeSync(prompt, previousResponseId = null, workingDirectory = null) {
    return new Promise((resolve, reject) => {
      const args = this.buildArgs(prompt, previousResponseId, false);
      const cwd = validateWorkingDirectory(workingDirectory);

      logger.debugLog(`Executing sync: ${this.cliPath} ${args.join(" ")}`);
      
      // Add timeout to prevent hanging (30 minutes)
      const timeout = setTimeout(() => {
        logger.error("Agent execution timed out");
        reject(new ExecutionError("Agent execution timed out after 30 minutes"));
      }, 30 * 60 * 1000);
      
      const claudeProcess = spawn(this.cliPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        cwd: cwd
      });

      let stdout = "";
      let stderr = "";

      claudeProcess.stdout?.on("data", (data) => {
        const chunk = data.toString();
        logger.debugLog(`STDOUT: ${chunk}`);
        stdout += chunk;
      });

      claudeProcess.stderr?.on("data", (data) => {
        const chunk = data.toString();
        logger.debugLog(`STDERR: ${chunk}`);
        stderr += chunk;
      });

      claudeProcess.on("close", (code) => {
        clearTimeout(timeout);
        logger.debugLog(`Process closed with code: ${code}`);
        
        if (code === 0) {
          try {
            const result = this.parseResponse(stdout, stderr);
            resolve(result);
          } catch (error) {
            reject(new ExecutionError(`Failed to parse agent response: ${error instanceof Error ? error.message : String(error)}`));
          }
        } else {
          reject(new ExecutionError(`Agent failed with exit code ${code}: ${stderr}`));
        }
      });

      claudeProcess.on("error", (error) => {
        clearTimeout(timeout);
        logger.error(`Process error: ${error.message}`);
        reject(new ExecutionError(`Failed to spawn agent process: ${error.message}`));
      });
    });
  }

  /**
   * Execute agent asynchronously with progress tracking
   */
  async executeAsync(taskService, taskId, prompt, previousResponseId = null, workingDirectory = null) {
    const task = taskService.getTaskOrThrow(taskId);
    taskService.updateTask(taskId, { status: 'running' });

    const args = this.buildArgs(prompt, previousResponseId, true);
    const cwd = validateWorkingDirectory(workingDirectory);

    logger.debugLog(`Executing async: ${this.cliPath} ${args.join(" ")}`);
    
    const claudeProcess = spawn(this.cliPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      cwd: cwd
    });

    // Store process for cancellation
    taskService.updateTask(taskId, { process: claudeProcess });

    let stdout = "";
    let stderr = "";
    let lastResult = null;

    claudeProcess.stdout?.on("data", (data) => {
      const chunk = data.toString();
      logger.debugLog(`ASYNC STDOUT: ${chunk}`);
      stdout += chunk;

      // Parse streaming JSON for progress updates
      const lines = chunk.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.type === 'result') {
            lastResult = message;
          }
        } catch (parseError) {
          // Ignore parse errors for partial JSON
        }
      }
    });

    claudeProcess.stderr?.on("data", (data) => {
      const chunk = data.toString();
      logger.debugLog(`ASYNC STDERR: ${chunk}`);
      stderr += chunk;
    });

    claudeProcess.on("close", (code) => {
      logger.debugLog(`Async process closed with code: ${code}`);
      
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
            result = this.parseResponse(lastLine, stderr);
          }
          taskService.updateTask(taskId, { 
            status: 'completed', 
            result,
            process: null 
          });
        } catch (error) {
          taskService.updateTask(taskId, { 
            status: 'failed', 
            error: `Failed to parse agent response: ${error instanceof Error ? error.message : String(error)}\nOutput: ${stdout}`,
            process: null
          });
        }
      } else {
        taskService.updateTask(taskId, { 
          status: 'failed', 
          error: `Agent failed with exit code ${code}: ${stderr}`,
          process: null
        });
      }
    });

    claudeProcess.on("error", (error) => {
      logger.error(`Async process error: ${error.message}`);
      taskService.updateTask(taskId, { 
        status: 'failed', 
        error: `Failed to spawn agent process: ${error.message}`,
        process: null
      });
    });
  }
}