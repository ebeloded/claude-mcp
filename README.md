# Claude Code MCP Server

An MCP (Model Context Protocol) server that allows AI tools to interact with Claude Code programmatically, enabling powerful agent-in-agent workflows with conversation continuity and asynchronous execution support.

## Overview

This MCP server provides a bridge between AI tools and Claude Code, allowing other AI systems to execute prompts via Claude Code while maintaining session state for conversation continuity. It supports both synchronous and asynchronous execution patterns, making it suitable for quick queries and long-running operations.

## Features

- **Fresh conversations** - `start` tool for starting new conversations (sync/async)
- **Resume conversations** - `resume` tool for continuing existing conversations (sync/async)
- **Working directory support** - Execute Claude Code in any directory (fresh conversations only)
- **Task management** - Monitor tasks with elapsed time, cancel operations, and retrieve results
- **Conversation branching** - Resume from any previous response ID to branch conversations
- **Robust CLI detection** - Automatically finds Claude Code installation
- **Permission bypass** - Uses `--dangerously-skip-permissions` for full functionality
- **Environment configuration** - Customizable via environment variables
- **Debug logging** - Optional verbose logging for troubleshooting
- **Modular architecture** - Clean, maintainable codebase with separation of concerns
- **Automated publishing** - GitHub Actions workflow for releases
- **System notifications** - macOS notifications for task start/completion with distinct sounds
- **Process cleanup** - Automatic cleanup of orphaned processes when MCP server disconnects

## Prerequisites

- Node.js 18+ runtime
- Claude Code CLI installed and configured
- Claude Code must be run once with `--dangerously-skip-permissions` to accept terms

## Installation & Setup

### Option 1: NPX (No Installation)

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

### Option 2: Local Development

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

**Important:** Before using the setup above, run Claude Code once to accept permissions:

```bash
claude --dangerously-skip-permissions
```

Accept the terms when prompted (one-time requirement).

## Configuration

### MCP Client Configuration

Add the configuration to your MCP configuration file:

- **Cursor:** `~/.cursor/mcp.json`
- **Windsurf:** `~/.codeium/windsurf/mcp_config.json`

### Environment Variables

- `CLAUDE_CLI_NAME`: Override Claude CLI binary name (default: "claude")
- `MCP_CLAUDE_DEBUG`: Set to "true" for verbose debug logging
- `MCP_NOTIFICATIONS`: Set to "false" to disable macOS system notifications

## Tools

### `start` - Fresh Conversations

Start fresh conversations with Claude Code. Supports both synchronous and asynchronous execution.

**Parameters:**

- `message` (string, required): The message to send to the agent. Be specific about what you want - mention file paths, desired output format, and any constraints.
- `workingDirectory` (string, optional): Working directory to execute from. Use absolute paths or relative to current directory. Useful for different projects or git worktrees.
- `appendSystemPrompt` (string, optional): Text to append to the default system prompt.
- `async` (boolean, optional): Whether to execute asynchronously. Defaults to true.

**Example (Synchronous):**

```javascript
// Simple query in current directory
start({
  message: "What's 2 + 2?",
  async: false,
})

// Analyze specific code in project directory
start({
  message:
    "Analyze the authentication logic in src/auth.js and list security vulnerabilities as bullet points",
  workingDirectory: "/path/to/project",
  async: false,
})
```

**Response Format (Sync):**

```
4

Response ID: 938c8c6d-1897-4ce4-a727-d001a628a279
```

**Example (Asynchronous):**

```javascript
start({
  message:
    "Analyze the entire codebase for performance bottlenecks, focusing on database queries and API endpoints. Provide specific recommendations with file locations.",
})

start({
  message:
    "Review all React components in src/components/ for accessibility issues and generate a detailed report with WCAG compliance suggestions",
  workingDirectory: "/path/to/frontend-project",
})
```

**Response (Async):**

```
Task started successfully. Use status with task ID: 550e8400-e29b-41d4-a716-446655440000
```

### `resume` - Continue Conversations

Continue an existing conversation with Claude Code. Supports both synchronous and asynchronous execution. Uses the original conversation's working directory.

**Parameters:**

- `message` (string, required): The message to send to the agent. Reference previous context when needed - the agent remembers the conversation history.
- `previousResponseId` (string, required): Response ID from a previous agent response. Use to branch or continue any conversation.
- `async` (boolean, optional): Whether to execute asynchronously. Defaults to true.

**Example (Synchronous):**

```javascript
resume({
  message: "What did I just ask you?",
  previousResponseId: "938c8c6d-1897-4ce4-a727-d001a628a279",
  async: false,
})
```

**Response Format (Sync):**

```
You asked me about 2 + 2.

Response ID: b2c3d4e5-f6g7-8901-bcde-f23456789012
```

**Example (Asynchronous):**

```javascript
resume({
  message: "Continue that analysis with more detail",
  previousResponseId: "938c8c6d-1897-4ce4-a727-d001a628a279",
})
```

**Response (Async):**

```
Task started successfully. Use status with task ID: 661f9511-e30c-41e5-a927-556677889900
```

### `status` - Task Status Monitoring

Check the status and progress of an asynchronous task.

**Parameters:**

- `taskId` (string, required): The task ID returned by `ask_async`

**Example:**

```javascript
status({
  taskId: "550e8400-e29b-41d4-a716-446655440000",
})
```

**Response (Running):**

```
Task 550e8400-e29b-41d4-a716-446655440000:
Status: running
Elapsed: 45s
Working Directory: /Users/ebeloded/Code/claude-mcp
Created: 2025-05-28T21:15:30.123Z
Updated: 2025-05-28T21:16:15.456Z
```

**Response (Completed):**

```
Task 550e8400-e29b-41d4-a716-446655440000:
Status: completed
Elapsed: 1m 52s
Working Directory: /Users/ebeloded/Code/claude-mcp
Created: 2025-05-28T21:15:30.123Z
Updated: 2025-05-28T21:17:22.789Z

Result: [Claude's comprehensive analysis here...]
Response ID: 938c8c6d-1897-4ce4-a727-d001a628a279
Cost: $0.045
Duration: 112456ms
```

### `cancel` - Task Cancellation

Cancel a running asynchronous task.

**Parameters:**

- `taskId` (string, required): The task ID to cancel

**Example:**

```javascript
cancel({
  taskId: "550e8400-e29b-41d4-a716-446655440000",
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
│   ├── server/
│   │   └── setup.js             # MCP server setup and signal handling
│   ├── services/
│   │   ├── TaskService.js       # Async task lifecycle & notification management
│   │   └── ClaudeService.js     # Claude CLI execution logic
│   ├── tools/
│   │   └── (MCP tool definitions)
│   └── utils/
│       ├── errors.js            # Error handling utilities
│       ├── logger.js            # Debug logging utilities
│       └── validation.js       # Input validation utilities
└── tests/
    └── *.e2e.test.ts            # End-to-end tests
```

### Component Responsibilities

- **TaskService**: Handles async task creation, tracking, progress monitoring, cancellation, cleanup, and system notifications
- **ClaudeService**: Manages Claude CLI discovery and execution for both sync and async patterns with process group management
- **Setup**: MCP server initialization, signal handling, and graceful shutdown coordination
- **Tools**: Six MCP tools registered directly in server.js using MCP SDK pattern
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

### Fresh Conversations (`start`)

- Starting new conversations or analysis
- Working with different codebases (using `workingDirectory`)
- Quick queries and immediate responses (sync mode)
- Long-running operations that need to be non-blocking (async mode)
- Analyzing projects in separate directories or git worktrees
- Custom system prompts for specialized behavior

### Resume Conversations (`resume`)

- Continuing existing conversations and context
- Building on previous responses or analysis
- Following up with questions about prior context
- Branching conversations from any previous response
- Maintaining conversation continuity within the same working directory
- Both sync and async execution modes

## Writing Effective Prompts

Each tool provides detailed message guidance in its parameter descriptions to help you get the best results from Claude Code. The key principles are:

- **Be specific** about what you want analyzed or created
- **Mention file paths** and directories to focus Claude's attention
- **Specify output format** (bullet points, JSON, code snippets, etc.)
- **Include constraints** and focus areas (performance, security, accessibility, etc.)
- **For resume tools**: Reference previous context and build incrementally

See the tool parameter descriptions for comprehensive guidance and examples.

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
- Use `status` to monitor long-running tasks
- Tasks can be cancelled with `cancel` if needed
- Check debug logs if tasks appear stuck
- Tasks are automatically cancelled when MCP server disconnects

### System Notifications

- macOS notifications show task start ("Agent Task Started") and completion ("Agent Task Completed")
- Different sounds for start (Tink) vs completion (Glass/Basso/Funk based on result)
- Disable with `MCP_NOTIFICATIONS=false` environment variable
- Notifications include truncated prompt text for context

### Performance Considerations

- Async tasks don't block the MCP server
- Multiple async tasks can run concurrently
- Monitor task progress to avoid resource exhaustion
- Consider task cancellation for very long operations
- Parent process monitoring prevents orphaned processes
