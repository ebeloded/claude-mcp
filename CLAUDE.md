# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm test` - Run the full test suite using Vitest
- `npm start` - Start the MCP server (runs server.js)
- `MCP_CLAUDE_DEBUG=true npm start` - Start with debug logging enabled

### Testing
- `npm test` - Run all end-to-end tests
- Individual test files are located in `tests/` directory

### TypeScript Checking
- `npx tsc --noEmit` - Check TypeScript compilation without emitting files (JavaScript files use JSDoc typing)

## Architecture

This is an MCP (Model Context Protocol) server that bridges AI tools with Claude Code CLI, enabling conversation continuity and async execution patterns.

### Core Components

**server.js** - Main entry point that:
- Registers 6 MCP tools using `server.tool()` pattern from MCP SDK
- Uses direct tool registration (not factory functions) following MCP TypeScript SDK documentation
- Orchestrates TaskManager and ClaudeExecutor components

**TaskManager** (`src/managers/TaskManager.js`):
- Manages async task lifecycle with states: pending → running → completed/failed/cancelled
- Stores tasks in memory Map with automatic cleanup after 1 hour
- Handles task cancellation by killing spawned Claude CLI processes
- Uses `randomUUID()` for task ID generation

**ClaudeExecutor** (`src/executors/ClaudeExecutor.js`):
- Discovers Claude CLI installation (checks local `~/.claude/local/claude` first, then PATH)
- Executes both sync (`executeSync`) and async (`executeAsync`) Claude Code calls
- Async execution uses `--output-format stream-json --verbose` for progress tracking
- Sync execution uses `--output-format json`
- Always includes `--dangerously-skip-permissions` flag

### MCP Tools Architecture

The server provides 4 tools following conversation branching model:

1. **start** - Fresh conversations (sync/async), returns clean text + Response ID or task ID
2. **resume** - Continue conversation (sync/async) with previous response ID
3. **status** - Polls task progress and results
4. **cancel** - Terminates running tasks

### Conversation Continuity

Uses `previousResponseId` parameter (not "sessionId") because:
- Each Claude response generates a new response ID
- You can branch conversations from any previous response ID
- Each response becomes a new conversation checkpoint
- Parameter renamed from `sessionId` to clarify this branching behavior

**Important Limitation**: Claude Code stores conversation state relative to the working directory. Conversation continuity may not work when changing working directories between calls. This is a Claude Code limitation, not an MCP server issue.

### Environment Variables

- `MCP_CLAUDE_DEBUG=true` - Enable verbose logging to stderr
- `CLAUDE_CLI_NAME` - Override Claude CLI binary name/path (defaults to "claude")

### Working with Git Worktrees

When tasking agents to work on experimental features or refactoring:

1. **Create a worktree first**: Use `git worktree add ../project-name-feature -b feature/branch-name`
2. **Task agents with specific working directory**: Always specify the worktree path as `workingDirectory` parameter
3. **Agent isolation**: Each agent should work in its own worktree to avoid conflicts
4. **Commit in worktree**: Agents should commit their changes within the worktree before completion
5. **Merge back**: Review and merge changes back to main branch when ready

**Example workflow**:
```bash
# Create worktree
git worktree add ../claude-mcp-refactor -b refactor/improvements

# Task agent with specific working directory
# Use workingDirectory: "/Users/username/Code/claude-mcp-refactor"
```

### Key Implementation Details

- Uses ES modules (`"type": "module"`)
- TypeScript type checking on JavaScript files via tsconfig.json `allowJs: true, checkJs: true`
- Async tasks use Node.js `spawn()` with progress parsing from streaming JSON
- Task cleanup prevents memory leaks in long-running MCP servers
- Error handling preserves original Claude Code error messages and exit codes