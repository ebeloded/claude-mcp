# Claude Code MCP Server

An MCP (Model Context Protocol) server that allows AI tools to interact with Claude Code programmatically, enabling powerful agent-in-agent workflows with conversation continuity and asynchronous execution support.

## Overview

This MCP server provides a bridge between AI tools and Claude Code, allowing other AI systems to execute prompts via Claude Code while maintaining session state for conversation continuity. It supports both synchronous and asynchronous execution patterns, making it suitable for quick queries and long-running operations.

## Features

- **Synchronous execution** - `ask` tool for immediate responses
- **Asynchronous execution** - `ask_async` tool for non-blocking long-running operations
- **Task management** - Monitor progress, cancel tasks, and retrieve results
- **Conversation continuity** - Resume previous conversations using response IDs
- **Robust CLI detection** - Automatically finds Claude Code installation
- **Permission bypass** - Uses `--dangerously-skip-permissions` for full functionality
- **Environment configuration** - Customizable via environment variables
- **Debug logging** - Optional verbose logging for troubleshooting
- **Modular architecture** - Clean, maintainable codebase with separation of concerns
- **Automated publishing** - GitHub Actions workflow for releases

## Prerequisites

- Node.js 18+ runtime
- Claude Code CLI installed and configured
- Claude Code must be run once with `--dangerously-skip-permissions` to accept terms

## Installation & Setup

### Option 1: NPM Global Install (Recommended)

```bash
npm install -g claude-mcp
```

Then use in your MCP config:

```json
{
  "mcpServers": {
    "claude": {
      "command": "claude-mcp"
    }
  }
}
```

### Option 2: NPX (No Installation)

Use directly with npx:

```json
{
  "mcpServers": {
    "claude": {
      "command": "npx",
      "args": ["claude-mcp"]
    }
  }
}
```

### Option 3: Local Development

1. **Clone and install:**
   ```bash
   git clone https://github.com/ebeloded/claude-mcp.git
   cd claude-mcp
   npm install
   ```

2. **Use in MCP config:**
   ```json
   {
     "mcpServers": {
       "claude": {
         "command": "node",
         "args": ["/path/to/claude-mcp/server.js"]
       }
     }
   }
   ```

### First-time Claude Code Setup

**Important:** Before using any option above, run Claude Code once to accept permissions:

```bash
claude --dangerously-skip-permissions
```

Accept the terms when prompted (one-time requirement).

## Configuration

### MCP Client Configuration

Choose one of the installation options above and add the corresponding configuration to your MCP configuration file:

- **Cursor:** `~/.cursor/mcp.json`
- **Windsurf:** `~/.codeium/windsurf/mcp_config.json`

### Environment Variables

- `CLAUDE_CLI_NAME`: Override Claude CLI binary name (default: "claude")
- `MCP_CLAUDE_DEBUG`: Set to "true" for verbose debug logging

## Tools

### `ask` - Synchronous Execution

Execute prompts via Claude Code with optional session continuity. Blocks until completion.

**Parameters:**
- `prompt` (string, required): The prompt to send to Claude Code
- `previousResponseId` (string, optional): Response ID to continue from a previous Claude response

**Example:**
```javascript
// First execution
ask({ 
  prompt: "What's 2 + 2?" 
})

// Continue conversation
ask({ 
  prompt: "Now multiply that by 3",
  previousResponseId: "938c8c6d-1897-4ce4-a727-d001a628a279"
})
```

**Response Format:**
```json
{
  "type": "result",
  "subtype": "success", 
  "result": "4",
  "session_id": "938c8c6d-1897-4ce4-a727-d001a628a279",
  "cost_usd": 0.015,
  "duration_ms": 4742,
  "num_turns": 1,
  "is_error": false,
  "total_cost": 0.015
}
```

### `ask_async` - Asynchronous Execution

Start a Claude Code execution in the background. Returns immediately with a task ID.

**Parameters:**
- `prompt` (string, required): The prompt to send to Claude Code  
- `previousResponseId` (string, optional): Response ID to continue from a previous Claude response

**Example:**
```javascript
ask_async({ 
  prompt: "Write a comprehensive analysis of quantum computing with detailed examples" 
})
```

**Response:**
```
Task started successfully. Use ask_status with task ID: 550e8400-e29b-41d4-a716-446655440000
```

### `ask_status` - Task Status Monitoring

Check the status and progress of an asynchronous task.

**Parameters:**
- `taskId` (string, required): The task ID returned by `ask_async`

**Example:**
```javascript
ask_status({ 
  taskId: "550e8400-e29b-41d4-a716-446655440000" 
})
```

**Response (Running):**
```
Task 550e8400-e29b-41d4-a716-446655440000:
Status: running
Progress: 45%
Created: 2025-05-28T21:15:30.123Z
Updated: 2025-05-28T21:16:15.456Z
```

**Response (Completed):**
```
Task 550e8400-e29b-41d4-a716-446655440000:
Status: completed
Progress: 100%
Created: 2025-05-28T21:15:30.123Z
Updated: 2025-05-28T21:17:22.789Z

Result: [Claude's comprehensive analysis here...]
Response ID: 938c8c6d-1897-4ce4-a727-d001a628a279
Cost: $0.045
Duration: 112456ms
```

### `ask_cancel` - Task Cancellation

Cancel a running asynchronous task.

**Parameters:**
- `taskId` (string, required): The task ID to cancel

**Example:**
```javascript
ask_cancel({ 
  taskId: "550e8400-e29b-41d4-a716-446655440000" 
})
```

**Response:**
```
Task 550e8400-e29b-41d4-a716-446655440000 cancelled successfully
```

## Architecture

The server follows a modular architecture for maintainability:

```
claude-mcp/
├── server.js                    # Main entry point & orchestration
├── src/
│   ├── managers/
│   │   └── TaskManager.js       # Async task lifecycle management
│   ├── executors/
│   │   └── ClaudeExecutor.js    # Claude CLI execution logic
│   └── tools/
│       └── (legacy tool modules - tools now registered directly in server.js)
└── tests/
    └── claudeCode.e2e.test.ts   # End-to-end tests
```

### Component Responsibilities

- **TaskManager**: Handles async task creation, tracking, progress monitoring, cancellation, and cleanup
- **ClaudeExecutor**: Manages Claude CLI discovery and execution for both sync and async patterns
- **Tools**: Four MCP tools registered directly in server.js using MCP SDK pattern
- **Server**: Minimal orchestration layer that wires components together

## Development

### Testing

```bash
npm test
```

The test suite includes:
- Synchronous execution with session management
- Asynchronous task creation and status monitoring
- Task cancellation capabilities
- Error handling for edge cases

### Debug Mode

Set `MCP_CLAUDE_DEBUG=true` to enable verbose logging:

```json
{
  "mcpServers": {
    "claude": {
      "command": "node",
      "args": ["/path/to/claude-mcp/server.js"],
      "env": {
        "MCP_CLAUDE_DEBUG": "true"
      }
    }
  }
}
```

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start in debug mode
MCP_CLAUDE_DEBUG=true npm start
```

## Use Cases

### Synchronous (`ask`)
- Quick queries and responses
- Interactive conversations
- When you need immediate results
- Simple automation tasks

### Asynchronous (`ask_async`)
- Long-running code generation
- Complex analysis tasks
- Large file processing
- When parent agent needs to remain responsive
- Batch processing scenarios

## Publishing

This project uses GitHub Actions for automated publishing:

- **Releases**: Create a GitHub release to automatically publish to npm
- **Manual**: Use the "Publish to npm" workflow dispatch for manual publishing

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Troubleshooting

### Claude CLI Not Found
- Ensure Claude CLI is installed and in your PATH
- Set `CLAUDE_CLI_NAME` environment variable if using a custom binary name
- Check that the CLI works: `claude --version`

### Permission Errors
- Run `claude --dangerously-skip-permissions` once to accept terms
- Ensure the MCP server has permission to execute the Claude CLI

### Conversation Continuity Issues
- Response IDs are returned in each response - save them for continuation
- Conversations may expire after extended periods of inactivity
- Each new conversation without a previousResponseId starts fresh
- You can branch conversations from any previous response ID

### Async Task Issues
- Tasks are automatically cleaned up after 1 hour of completion
- Use `ask_status` to monitor long-running tasks
- Tasks can be cancelled with `ask_cancel` if needed
- Check debug logs if tasks appear stuck

### Performance Considerations
- Async tasks don't block the MCP server
- Multiple async tasks can run concurrently
- Monitor task progress to avoid resource exhaustion
- Consider task cancellation for very long operations