import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { TaskService } from "../services/TaskService.js"
import { ClaudeService } from "../services/ClaudeService.js"
import { registerTools } from "../tools/index.js"
import { logger } from "../utils/logger.js"
import { serverDisplayName, serverVersion } from "../utils/constants.js"

/**
 * Server setup and configuration
 */
export class McpServerSetup {
  constructor() {
    this.server = null
    this.taskService = null
    this.claudeService = null
    this.transport = null
  }

  /**
   * Initialize the MCP server with all services and tools
   */
  initialize() {
    // Create an MCP server
    this.server = new McpServer({
      name: serverDisplayName,
      version: serverVersion,
    })

    // Initialize services
    this.taskService = new TaskService()
    this.claudeService = new ClaudeService()

    // Pass server instance to TaskService for notifications
    this.taskService.setServer(this.server)

    // Register all tools
    registerTools(this.server, this.claudeService, this.taskService)

    // Setup transport
    this.transport = new StdioServerTransport()

    // Setup cleanup handlers
    this.setupCleanupHandlers()

    logger.info("MCP Server initialized successfully")
  }

  /**
   * Setup cleanup handlers for graceful shutdown
   */
  setupCleanupHandlers() {
    const cleanup = (signal) => {
      logger.info(`Received ${signal}, cleaning up...`)
      logger.info(
        `Active tasks: ${
          this.taskService ? this.taskService.getStats().active : 0
        }`
      )
      if (this.taskService) {
        this.taskService.destroy()
      }
      process.exit(0)
    }

    // Handle more signals and add debug logging
    process.on("SIGINT", () => {
      logger.info("SIGINT received")
      cleanup("SIGINT")
    })
    process.on("SIGTERM", () => {
      logger.info("SIGTERM received")
      cleanup("SIGTERM")
    })
    process.on("SIGHUP", () => {
      logger.info("SIGHUP received")
      cleanup("SIGHUP")
    })

    // Log when process is about to exit
    process.on("exit", (code) => {
      logger.info(`Process exiting with code: ${code}`)
    })

    logger.info("Cleanup handlers registered for SIGINT, SIGTERM, SIGHUP")
  }

  /**
   * Start the server
   */
  async start() {
    if (!this.server || !this.transport) {
      throw new Error("Server not initialized. Call initialize() first.")
    }

    try {
      await this.server.connect(this.transport)
      logger.info("MCP Server started successfully")
    } catch (error) {
      logger.error("Failed to start MCP Server:", error)
      if (this.taskService) {
        this.taskService.destroy()
      }
      throw error
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      server: {
        name: serverDisplayName,
        version: serverVersion,
      },
      tasks: this.taskService ? this.taskService.getStats() : null,
    }
  }
}
