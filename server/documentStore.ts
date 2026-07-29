import { randomUUID } from "node:crypto";

import { z } from "zod";

const MAX_DOCUMENT_CHARACTERS = 10_000_000;
const MAX_PAGE_CHARACTERS = 200_000;
const MAX_TOOL_OUTPUT_CHARACTERS = 50_000;
const MAX_SEARCH_RESULTS = 5;

export const documentRegistrationSchema = z.object({
  pages: z.array(z.string().max(MAX_PAGE_CHARACTERS)).min(1).max(2_500),
  replacesDocumentId: z.string().uuid().nullable(),
});

export const readDocumentInputSchema = z
  .object({
    operation: z.enum(["overview", "page", "search"]),
    page: z.number().int().positive().nullable(),
    query: z.string().trim().min(1).max(500).nullable(),
  })
  .strict();

export type ReadDocumentInput = z.infer<typeof readDocumentInputSchema>;

const documents = new Map<string, string[]>();

function normalizePage(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function registerDocument(
  pages: string[],
  replacesDocumentId: string | null = null,
): string {
  const normalized = pages.map(normalizePage);
  const characterCount = normalized.reduce((total, page) => total + page.length, 0);
  if (characterCount > MAX_DOCUMENT_CHARACTERS) {
    throw new Error("This PDF has too much extracted text to register for AI document reading.");
  }
  const documentId = randomUUID();
  documents.set(documentId, normalized);
  if (replacesDocumentId) {
    documents.delete(replacesDocumentId);
  }
  return documentId;
}

export function removeDocument(documentId: string): boolean {
  return documents.delete(documentId);
}

function getPages(documentId: string): string[] {
  const pages = documents.get(documentId);
  if (!pages) {
    throw new Error("The PDF is no longer available to the AI. Reopen the document.");
  }
  return pages;
}

function clipToolOutput(text: string): string {
  if (text.length <= MAX_TOOL_OUTPUT_CHARACTERS) {
    return text;
  }
  return `${text.slice(0, MAX_TOOL_OUTPUT_CHARACTERS)}\n[Output clipped]`;
}

function overview(pages: string[]): string {
  const previews = pages.slice(0, 20).map((page, index) => {
    const preview = page.slice(0, 400) || "[No extractable text]";
    return `Page ${index + 1}: ${preview}`;
  });
  const omitted =
    pages.length > previews.length ? `\n${pages.length - previews.length} more pages.` : "";
  return clipToolOutput(`Document has ${pages.length} pages.\n${previews.join("\n")}${omitted}`);
}

function readPage(pages: string[], pageNumber: number | null): string {
  if (pageNumber === null) {
    throw new Error("A page number is required for the page operation.");
  }
  const page = pages[pageNumber - 1];
  if (page === undefined) {
    throw new Error(`Page ${pageNumber} is outside this ${pages.length}-page document.`);
  }
  return clipToolOutput(`Page ${pageNumber}:\n${page || "[No extractable text]"}`);
}

function searchPages(pages: string[], query: string | null): string {
  if (query === null) {
    throw new Error("A query is required for the search operation.");
  }
  const normalizedQuery = query.toLocaleLowerCase();
  const results: string[] = [];
  for (const [index, page] of pages.entries()) {
    const matchIndex = page.toLocaleLowerCase().indexOf(normalizedQuery);
    if (matchIndex >= 0) {
      const start = Math.max(0, matchIndex - 300);
      const end = Math.min(page.length, matchIndex + query.length + 500);
      results.push(`Page ${index + 1}:\n${page.slice(start, end)}`);
    }
    if (results.length === MAX_SEARCH_RESULTS) {
      break;
    }
  }
  return results.length > 0 ? results.join("\n\n") : `No pages matched “${query}”.`;
}

export function readDocument(documentId: string, rawInput: unknown): string {
  const input = readDocumentInputSchema.parse(rawInput);
  const pages = getPages(documentId);
  if (input.operation === "overview") {
    return overview(pages);
  }
  if (input.operation === "page") {
    return readPage(pages, input.page);
  }
  return searchPages(pages, input.query);
}

export function clearDocumentsForTests(): void {
  documents.clear();
}
