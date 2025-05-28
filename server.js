#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Create an MCP server
const server = new McpServer({
  name: "Claude Code MCP Server",
  version: "1.0.0",
});

// Debug flag
const DEBUG = process.env.MCP_CLAUDE_DEBUG === "true";

function debugLog(...args) {
  if (DEBUG) {
    console.error("[DEBUG]", ...args);
  }
}

// Find Claude CLI binary
function findClaudeCli() {
  const customCliName = process.env.CLAUDE_CLI_NAME || "claude";
  
  debugLog(`Looking for Claude CLI, custom name: ${customCliName}`);
  
  // Check if it's an absolute path
  if (customCliName.startsWith("/")) {
    debugLog(`Using absolute path: ${customCliName}`);
    return customCliName;
  }
  
  // For default "claude", check local installation first
  if (customCliName === "claude") {
    const userPath = join(homedir(), ".claude", "local", "claude");
    debugLog(`Checking local path: ${userPath}`);
    
    if (existsSync(userPath)) {
      debugLog(`Found local Claude CLI at: ${userPath}`);
      return userPath;
    }
  }
  
  // Fallback to PATH lookup
  debugLog(`Using PATH lookup for: ${customCliName}`);
  return customCliName;
}

// Helper function to execute Claude Code commands
async function executeClaudeCode(prompt, sessionId) {
  return new Promise((resolve, reject) => {
    const claudePath = findClaudeCli();
    
    const args = ["-p", prompt, "--output-format", "json"];

    // Add session resumption if sessionId provided
    if (sessionId) {
      args.push("--resume", sessionId);
    }

    // Skip permissions for now (dangerous but functional)
    args.push("--dangerously-skip-permissions");

    debugLog(`Executing: ${claudePath} ${args.join(" ")}`);
    
    // Add timeout to prevent hanging (30 minutes like the reference)
    const timeout = setTimeout(() => {
      debugLog("Claude Code execution timed out");
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
      debugLog(`STDOUT: ${chunk}`);
      stdout += chunk;
    });

    claudeProcess.stderr?.on("data", (data) => {
      const chunk = data.toString();
      debugLog(`STDERR: ${chunk}`);
      stderr += chunk;
    });

    claudeProcess.on("close", (code) => {
      clearTimeout(timeout);
      debugLog(`Process closed with code: ${code}`);
      
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
      debugLog(`Process error: ${error.message}`);
      reject(new Error(`Failed to spawn Claude Code process: ${error.message}`));
    });
  });
}

// Add Claude Code execution tool
server.tool(
  "claude_execute",
  {
    prompt: z.string().describe("The prompt to send to Claude Code"),
    sessionId: z
      .string()
      .optional()
      .describe("Optional session ID to resume a previous conversation"),
  },
  async ({ prompt, sessionId }) => {
    try {
      const result = await executeClaudeCode(prompt, sessionId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Add version tool for testing
server.tool("claude_version", {}, async () => {
  try {
    const claudePath = findClaudeCli();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Version check timed out"));
      }, 5000);

      const claudeProcess = spawn(claudePath, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      claudeProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      claudeProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      claudeProcess.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({
            content: [
              { type: "text", text: `Claude version: ${stdout.trim()}` },
            ],
          });
        } else {
          resolve({
            content: [
              {
                type: "text",
                text: `Error: Exit code ${code}, stderr: ${stderr}`,
              },
            ],
          });
        }
      });

      claudeProcess.on("error", (error) => {
        clearTimeout(timeout);
        resolve({
          content: [{ type: "text", text: `Spawn error: ${error.message}` }],
        });
      });
    });
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Exception: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
});

// Start the server over stdio
const transport = new StdioServerTransport();

async function main() {
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});