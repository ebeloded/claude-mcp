// Centralized constants for server metadata
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Resolve package.json at repo root
const pkgPath = resolve(__dirname, "../../package.json")

let serverVersion = "0.0.0"
try {
  const pkgRaw = readFileSync(pkgPath, "utf-8")
  const pkg = JSON.parse(pkgRaw)
  serverVersion = typeof pkg.version === "string" ? pkg.version : serverVersion
} catch {
  // Fallback already set
}

// Human-friendly display name (keep stable for tests/UI)
export const serverDisplayName = "Claude Code MCP Server"
export { serverVersion }
