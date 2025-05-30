import { z } from "zod";
import { createErrorResponse } from "../utils/errors.js";

/**
 * Ask tool - Synchronous agent execution
 */
export const askTool = {
  name: "ask",
  schema: {
    prompt: z.string().describe("The prompt to send to the agent. For effective results: (1) Be specific about what you want, (2) Mention specific file paths or directories, (3) Specify desired output format (bullet points, JSON, etc.), (4) Include constraints or focus areas (performance, security, etc.). Example: 'Analyze the authentication logic in src/auth.js and list security vulnerabilities as bullet points, focusing on input validation and session management'"),
    workingDirectory: z
      .string()
      .optional()
      .describe("Optional working directory to execute the agent from. Use absolute paths or relative to current directory. Useful for working with different projects, git worktrees, or specific subdirectories."),
  },
  handler: (claudeService) => async ({ prompt, workingDirectory }) => {
    try {
      const result = await claudeService.executeSync(prompt, undefined, workingDirectory);
      return {
        content: [
          {
            type: "text",
            text: `${result.result}\n\nResponse ID: ${result.session_id}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResponse(error);
    }
  }
};