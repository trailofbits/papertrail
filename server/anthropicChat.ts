import type { ChatRequest } from "./chat.ts";
import { systemPrompt } from "./chatContext.ts";
import {
  executeReadDocument,
  READ_DOCUMENT_DESCRIPTION,
  READ_DOCUMENT_PARAMETERS,
} from "./readDocumentTool.ts";

const MAX_TOOL_ROUNDS = 4;

type AnthropicBlock = {
  type?: string;
  id?: string;
  name?: string;
  input?: unknown;
  text?: string;
  [key: string]: unknown;
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicBlock[];
};

type AnthropicResponse = {
  content?: AnthropicBlock[];
  error?: { message?: string };
};

function toolUseBlocks(body: AnthropicResponse): AnthropicBlock[] {
  return (
    body.content?.filter(
      (block) =>
        block.type === "tool_use" && block.name === "read_document" && typeof block.id === "string",
    ) ?? []
  );
}

function answerText(body: AnthropicResponse): string {
  const answer = body.content
    ?.filter((block) => block.type === "text")
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .join("\n")
    .trim();
  if (!answer) {
    throw new Error("Claude returned an empty response. Try the question again.");
  }
  return answer;
}

async function callAnthropic(
  apiKey: string,
  request: ChatRequest,
  messages: AnthropicMessage[],
): Promise<AnthropicResponse> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-5",
      max_tokens: 3_200,
      output_config: { effort: request.reasoningEffort },
      system: systemPrompt(request),
      tools: [
        {
          name: "read_document",
          description: READ_DOCUMENT_DESCRIPTION,
          input_schema: READ_DOCUMENT_PARAMETERS,
        },
      ],
      messages,
    }),
  });
  const body = (await response.json()) as AnthropicResponse;
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Claude request failed (${response.status}).`);
  }
  return body;
}

function toolResults(documentId: string, calls: AnthropicBlock[]): AnthropicBlock[] {
  return calls.map((call) => ({
    type: "tool_result",
    tool_use_id: call.id,
    content: executeReadDocument(documentId, call.input),
  }));
}

export async function askAnthropic(request: ChatRequest): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("Claude is not configured. Add ANTHROPIC_API_KEY to .env.");
  }

  const messages: AnthropicMessage[] = [
    ...request.messages,
    { role: "user", content: request.prompt },
  ];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const body = await callAnthropic(apiKey, request, messages);
    const calls = toolUseBlocks(body);
    if (calls.length === 0) {
      return answerText(body);
    }
    messages.push(
      { role: "assistant", content: body.content ?? [] },
      { role: "user", content: toolResults(request.documentId, calls) },
    );
  }
  throw new Error("Claude used too many document-reading steps. Ask a narrower question.");
}
