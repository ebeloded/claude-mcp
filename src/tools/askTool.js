import { z } from "zod";

/**
 * Synchronous Claude Code execution tool
 */
export function createAskTool(claudeExecutor) {
  return {
    name: "ask",
    schema: {
      prompt: z.string().describe("The prompt to send to Claude Code"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID to resume a previous conversation. Note: Claude generates a new session ID for each response, but can still access previous conversation history when this parameter is provided."),
    },
    handler: async (args) => {
      const { prompt, sessionId } = args;
      try {
        const result = await claudeExecutor.executeSync(prompt, sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  };
}