# Claude Code MCP Server

An MCP (Model Context Protocol) server that allows AI tools to interact with Claude Code programmatically, enabling powerful agent-in-agent workflows with conversation continuity.

## Overview

This MCP server provides a bridge between AI tools and Claude Code, allowing other AI systems to execute prompts via Claude Code while maintaining session state for conversation continuity.

## Features

- **Simple `ask` tool** for executing prompts via Claude Code
- **Session management** - Resume previous conversations using session IDs
- **Robust CLI detection** - Automatically finds Claude Code installation
- **Permission bypass** - Uses `--dangerously-skip-permissions` for full functionality
- **Environment configuration** - Customizable via environment variables
- **Debug logging** - Optional verbose logging for troubleshooting
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

### `ask`

Execute prompts via Claude Code with optional session continuity.

**Parameters:**
- `prompt` (string, required): The prompt to send to Claude Code
- `sessionId` (string, optional): Session ID to resume a previous conversation

**Example:**
```javascript
// First execution
ask({ 
  prompt: "What's 2 + 2?" 
})

// Continue conversation
ask({ 
  prompt: "Now multiply that by 3",
  sessionId: "938c8c6d-1897-4ce4-a727-d001a628a279"
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
      "command": "node",
      "args": ["/path/to/claude-mcp/server.js"],
      "env": {
        "MCP_CLAUDE_DEBUG": "true"
      }
    }
  }
}
```

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

### Session Continuity Issues
- Session IDs are returned in the response - save them for continuation
- Sessions may expire after extended periods of inactivity
- Each new conversation without a sessionId starts fresh