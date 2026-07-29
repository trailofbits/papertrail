import { describe, expect, it } from "vitest";

import { chatRequestSchema } from "./chat.ts";
import { systemPrompt } from "./chatContext.ts";

const request = {
  provider: "openai" as const,
  documentId: "123e4567-e89b-42d3-a456-426614174000",
  selectedText: "the highlighted claim",
  surroundingContext: "A paragraph containing the highlighted claim and its setup.",
  notepadContext: "Compare this with the author's earlier definition.",
  reasoningEffort: "medium" as const,
  messages: [],
  globalContext: [],
  prompt: "What does this imply?",
};

describe("AI chat context", () => {
  it("requires document access, notepad context, and reasoning effort", () => {
    expect(chatRequestSchema.parse(request)).toEqual(request);
    expect(() => chatRequestSchema.parse({ ...request, surroundingContext: undefined })).toThrow(
      "Invalid input",
    );
    expect(() => chatRequestSchema.parse({ ...request, notepadContext: undefined })).toThrow(
      "Invalid input",
    );
    expect(() => chatRequestSchema.parse({ ...request, reasoningEffort: "minimal" })).toThrow(
      "Invalid option",
    );
  });

  it("gives the provider the highlight, paragraph, and notepad", () => {
    const prompt = systemPrompt(request);

    expect(prompt).toContain(`Highlighted passage:\n${request.selectedText}`);
    expect(prompt).toContain(`Surrounding paragraph:\n${request.surroundingContext}`);
    expect(prompt).toContain(`Plain notepad for this highlight:\n${request.notepadContext}`);
    expect(prompt).toContain("read_document");
  });
});
