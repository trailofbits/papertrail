import { readDocument } from "./documentStore.ts";

export const READ_DOCUMENT_PARAMETERS = {
  type: "object",
  properties: {
    operation: {
      type: "string",
      enum: ["overview", "page", "search"],
      description: "Use overview for structure, page for one page, or search for matching text.",
    },
    page: {
      type: ["integer", "null"],
      description: "One-indexed page number for page reads; otherwise null.",
    },
    query: {
      type: ["string", "null"],
      description: "Search phrase for search operations; otherwise null.",
    },
  },
  required: ["operation", "page", "query"],
  additionalProperties: false,
} as const;

export const READ_DOCUMENT_DESCRIPTION =
  "Read the open PDF. Get a page overview, read a full page, or search all extracted page text.";

export function executeReadDocument(documentId: string, rawInput: unknown): string {
  try {
    return readDocument(documentId, rawInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The document read failed.";
    return `read_document error: ${message}`;
  }
}
