import { z } from "zod";

import { askAnthropic } from "./anthropicChat.ts";
import { askOpenAI } from "./openaiChat.ts";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(40_000),
});

export const chatRequestSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  documentId: z.string().uuid(),
  selectedText: z.string().trim().min(1).max(80_000),
  surroundingContext: z.string().trim().min(1).max(20_000),
  notepadContext: z.string().max(40_000),
  reasoningEffort: z.enum(["low", "medium", "high"]),
  messages: z.array(messageSchema).max(100),
  globalContext: z.array(messageSchema).max(200),
  prompt: z.string().trim().min(1).max(20_000),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export async function answerQuestion(request: ChatRequest): Promise<string> {
  if (request.provider === "openai") {
    return askOpenAI(request);
  }
  return askAnthropic(request);
}
