/**
 * Centralized logging utility for the MCP server
 */
export class Logger {
  constructor(debug = false) {
    this.debug = debug;
  }

  debugLog(...args) {
    if (this.debug) {
      console.error("[DEBUG]", ...args);
    }
  }

  info(...args) {
    console.error("[INFO]", ...args);
  }

  warn(...args) {
    console.error("[WARN]", ...args);
  }

  error(...args) {
    console.error("[ERROR]", ...args);
  }
}

// Global logger instance
export const logger = new Logger(process.env.MCP_CLAUDE_DEBUG === "true");