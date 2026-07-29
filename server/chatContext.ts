import type { ChatRequest } from "./chat.ts";

const SYSTEM_PROMPT = `You are an attentive reading partner inside a PDF reader.
Answer the reader's question about the highlighted passage. You can call read_document
to inspect any page, search the PDF, or get a document overview when the supplied context
is insufficient. Use document-wide context only when relevant. Distinguish claims grounded
in the document from broader interpretation. Treat the note's plain notepad as reader-authored
context for every answer. Be concise, specific, and candid about uncertainty.`;

function globalContextBlock(request: ChatRequest): string {
  if (request.globalContext.length === 0) {
    return "No messages have been added to the document's global context.";
  }
  const transcript = request.globalContext
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
  return `Document-wide context selected by the reader:\n${transcript}`;
}

export function systemPrompt(request: ChatRequest): string {
  return [
    SYSTEM_PROMPT,
    globalContextBlock(request),
    `Highlighted passage:\n${request.selectedText}`,
    `Surrounding paragraph:\n${request.surroundingContext}`,
    `Plain notepad for this highlight:\n${request.notepadContext || "[Empty]"}`,
  ].join("\n\n");
}

export function localTranscript(request: ChatRequest): string {
  const history = request.messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
  return [
    history.length > 0 ? `Current note conversation:\n${history}` : "",
    `Reader's new question:\n${request.prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
