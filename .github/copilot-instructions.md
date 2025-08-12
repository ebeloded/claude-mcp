# AI agent quickstart and rules for this repo

Purpose: This MCP server bridges AI tools to the Claude Code CLI with sync/async execution and conversation continuity via Response IDs. Keep behavior compatible with existing tests and CLI output expectations.

## Architecture and responsibilities

- Entrypoints: `server.js` → `src/server/setup.js` (creates McpServer, registers tools, stdio transport, signal cleanup).
- Services:
  - `src/services/ClaudeService.js`: Finds CLI (`CLAUDE_CLI_NAME` or `~/.claude/local/claude` or PATH), builds args, runs sync (`--output-format json`) and async (`--output-format stream-json --verbose`), parses JSON; if stdout isn’t JSON, falls back to plain text and extracts `Response ID: …` from stderr.
  - `src/services/TaskService.js`: Async task lifecycle (pending/running/completed/failed/cancelled), cancellation (kill process group), periodic cleanup, optional MCP notifications, macOS notifications via `osascript` + `afplay`, parent-process watchdog to auto-cancel.
- Tools (MCP): `src/tools/{start,resume,status,cancel}.js`, wired via `src/tools/index.js`. Schemas with zod; handlers close over `(claudeService, taskService)`.
- Utils: `src/utils/{validation,errors,logger}.js` for workingDirectory checks, standardized text responses, and debug logging gated by `MCP_CLAUDE_DEBUG`.

## Developer workflows

- Tests (Vitest E2E): `npm test`. Tests spawn `server.js` over stdio and assert text content (not JSON RPC payloads directly).
- Run server: `npm start`. Verbose logs: `MCP_CLAUDE_DEBUG=true npm start`.
- One-time setup: run `claude --dangerously-skip-permissions` once to accept permissions.

## Behavioral contracts (must match tests)

- Sync response shape (start/resume): return MCP text content that ends with a line `Response ID: <uuid>`.
  - Example: `{ content: [{ type: "text", text: `${result.result}\n\nResponse ID: ${result.session_id}` }] }`.
- Async start/resume: return `Task started successfully. Use status with task ID: <uuid>` then track via `status`.
- `status` output (text) must include: Task <id>, Status, Elapsed, Working Directory, Created/Updated timestamps. If completed, include Result, Response ID, Cost, Duration. If failed, include Error.
- `resume` requires `previousResponseId` (zod schema enforces). It uses the original conversation’s working directory; don’t allow overriding it on resume.

## Conventions and patterns

- Tool module pattern: export `{ name, schema, handler }`. Register via `server.tool(name, schema, handler(claudeService, taskService))`.
- Validation: prefer zod for schemas; use `validateWorkingDirectory`, `validateMessage`. Convert thrown errors via `createErrorResponse()` so callers see `Error: ...` in text (tests allow this when CLI is missing).
- CLI flags: always include `--dangerously-skip-permissions`. Async uses streaming JSON; keep last `{ type: "result" }` seen as final if present.
- Process control: store spawned process on the task for cancellation and clear it on close.
- Logging: `logger.debugLog` wraps stdout/stderr stream logs; controlled by `MCP_CLAUDE_DEBUG`.

## Integration details and env

- Transport: stdio (`StdioServerTransport`) only.
- Env vars: `CLAUDE_CLI_NAME` (override path/name), `MCP_CLAUDE_DEBUG` (verbose), `MCP_NOTIFICATIONS=false` (disable macOS notifications).
- Working directory: allow absolute/relative; missing or inaccessible paths must throw a `ValidationError`.
- Modules/types: ES modules (`type: module`); JS is type-checked via tsconfig (`allowJs` + `checkJs`).
- Conversation branching uses `previousResponseId` (not a sessionId); Claude Code ties conversation state to the working directory (don’t change directories when resuming).

## Concrete examples (from tests)

- Arithmetic prompt (sync): `start { message: "What is 2 + 2?", async: false }` → text + `Response ID:` line.
- Session continuity: `start` remember 42 → parse `Response ID`, then `resume { message: "What number…?", previousResponseId }`.
- Working directory usage: `start { message: "List files", workingDirectory: "./tests", async: false }`.
- System prompt tweak: `start { appendSystemPrompt: 'You are a pirate…', async: false }` → response text still ends with `Response ID:`.

Adhere to these formats to keep `tests/*.e2e.test.ts` green and ensure predictable client integration.
