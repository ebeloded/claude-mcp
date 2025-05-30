import { z } from "zod";
import { createErrorResponse } from "../utils/errors.js";

/**
 * Resume tool - Continue conversation synchronously
 */
export const resumeTool = {
  name: "resume",
  schema: {
    prompt: z.string().describe("The prompt to send to the agent to continue a conversation. Since the agent remembers context: (1) Reference previous responses naturally ('that function', 'the code you analyzed'), (2) Build incrementally ('now add...', 'what about...'), (3) Ask follow-up questions, (4) Request modifications or extensions. Example: 'Now add comprehensive error handling to that authentication function, including input validation and proper logging'"),
    previousResponseId: z
      .string()
      .describe("Response ID to continue from a previous agent response. Use the Response ID from any previous ask/resume call to branch or continue that conversation."),
  },
  handler: (claudeService) => async ({ prompt, previousResponseId }) => {
    try {
      const result = await claudeService.executeSync(prompt, previousResponseId, undefined);
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