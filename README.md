# Claude Code MCP Server

An MCP (Model Context Protocol) server that allows AI tools to interact with Claude Code programmatically, enabling powerful agent-in-agent workflows with conversation continuity.

## Overview

This MCP server provides a bridge between AI tools and Claude Code, allowing other AI systems to execute prompts via Claude Code while maintaining session state for conversation continuity.

## Features

- **Single `claude_execute` tool** for executing prompts via Claude Code
- **Session management** - Resume previous conversations using session IDs
- **Robust CLI detection** - Automatically finds Claude Code installation
- **Permission bypass** - Uses `--dangerously-skip-permissions` for full functionality
- **Environment configuration** - Customizable via environment variables
- **Debug logging** - Optional verbose logging for troubleshooting

## Prerequisites

- Node.js/Bun runtime
- Claude Code CLI installed and configured
- Claude Code must be run once with `--dangerously-skip-permissions` to accept terms

## Installation & Setup

### Option 1: NPX (Recommended)

No installation required! Use directly with npx:

```json
{
  "mcpServers": {
    "claude": {
      "type": "stdio", 
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
         "type": "stdio",
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

### `claude_execute`

Execute prompts via Claude Code with optional session continuity.

**Parameters:**
- `prompt` (string, required): The prompt to send to Claude Code
- `sessionId` (string, optional): Session ID to resume a previous conversation

**Example:**
```javascript
// First execution
mcp__claude__claude_execute({ 
  prompt: "List the files in this directory" 
})

// Continue conversation
mcp__claude__claude_execute({ 
  prompt: "Now show me the contents of server.ts",
  sessionId: "938c8c6d-1897-4ce4-a727-d001a628a279"
})
```

**Response Format:**
```json
{
  "type": "result",
  "subtype": "success", 
  "result": "Command output here",
  "session_id": "uuid-for-continuation",
  "cost_usd": 0.015,
  "duration_ms": 4742,
  "is_error": false
}
```

## Development

### Testing

```bash
npm test
```

### Debug Mode

Set `MCP_CLAUDE_DEBUG=true` to enable verbose logging:

```json
{
  "mcpServers": {
    "claude": {
      "type": "stdio", 
      "command": "bun",
      "args": ["/path/to/claude-mcp/server.ts"],
      "env": {
        "MCP_CLAUDE_DEBUG": "true"
      }
    }
  }
}
```

## Use Cases

- **Agent-in-agent workflows** - Let AI tools delegate complex tasks to Claude Code
- **File operations** - Reading, writing, editing files through Claude Code's tools
- **Code analysis** - Leverage Claude Code's programming capabilities
- **System interactions** - Execute shell commands, git operations, etc.
- **Multi-step workflows** - Maintain conversation context across multiple operations

## Troubleshooting

- **"Command not found"**: Ensure Claude Code CLI is installed and in PATH
- **Hanging requests**: Check that `--dangerously-skip-permissions` was accepted
- **Permission errors**: Verify Claude Code runs manually with the same flags
- **Path issues**: Use `CLAUDE_CLI_NAME` environment variable for custom paths

## License

MIT