import OpenAI from "openai";
import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses.js";

import type { ChatRequest } from "./chat.ts";
import { localTranscript, systemPrompt } from "./chatContext.ts";
import {
  executeReadDocument,
  READ_DOCUMENT_DESCRIPTION,
  READ_DOCUMENT_PARAMETERS,
} from "./readDocumentTool.ts";

const MAX_TOOL_ROUNDS = 4;
const READ_DOCUMENT_TOOL: FunctionTool = {
  type: "function",
  name: "read_document",
  description: READ_DOCUMENT_DESCRIPTION,
  parameters: READ_DOCUMENT_PARAMETERS,
  strict: true,
};

type ReplayableOutput = Extract<
  ResponseOutputItem,
  { type: "function_call" | "message" | "reasoning" }
>;

function isReadDocumentCall(item: ResponseOutputItem): item is ResponseFunctionToolCall {
  return item.type === "function_call" && item.name === "read_document";
}

function isReplayableOutput(item: ResponseOutputItem): item is ReplayableOutput {
  return item.type === "function_call" || item.type === "message" || item.type === "reasoning";
}

function toolOutput(documentId: string, argumentsJson: string): string {
  try {
    return executeReadDocument(documentId, JSON.parse(argumentsJson) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool arguments were not valid JSON.";
    return `read_document error: ${message}`;
  }
}

function answerText(response: { output_text: string }): string {
  const answer = response.output_text.trim();
  if (!answer) {
    throw new Error("OpenAI returned an empty response. Try the question again.");
  }
  return answer;
}

export async function askOpenAI(request: ChatRequest): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OpenAI is not configured. Add OPENAI_API_KEY to .env.");
  }

  const client = new OpenAI({ apiKey });
  const requestOptions = {
    model: process.env["OPENAI_MODEL"] ?? "gpt-5.6",
    instructions: systemPrompt(request),
    include: ["reasoning.encrypted_content" as const],
    reasoning: { effort: request.reasoningEffort },
    store: false,
    tools: [READ_DOCUMENT_TOOL],
  };
  const conversation: ResponseInputItem[] = [{ role: "user", content: localTranscript(request) }];
  let response = await client.responses.create({
    ...requestOptions,
    input: conversation,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = response.output.filter(isReadDocumentCall);
    if (calls.length === 0) {
      return answerText(response);
    }
    conversation.push(
      ...response.output.filter(isReplayableOutput),
      ...calls.map((call) => ({
        type: "function_call_output" as const,
        call_id: call.call_id,
        output: toolOutput(request.documentId, call.arguments),
      })),
    );
    response = await client.responses.create({
      ...requestOptions,
      input: conversation,
    });
  }
  throw new Error("OpenAI used too many document-reading steps. Ask a narrower question.");
}
