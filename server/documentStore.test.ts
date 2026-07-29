import { afterEach, describe, expect, it } from "vitest";

import {
  clearDocumentsForTests,
  readDocument,
  registerDocument,
  removeDocument,
} from "./documentStore.ts";

afterEach(clearDocumentsForTests);

describe("AI document reader", () => {
  it("provides an overview and one-indexed page reads", () => {
    const id = registerDocument(["First page text", "Second page text"]);

    expect(readDocument(id, { operation: "overview", page: null, query: null })).toContain(
      "Document has 2 pages.",
    );
    expect(readDocument(id, { operation: "page", page: 2, query: null })).toBe(
      "Page 2:\nSecond page text",
    );
  });

  it("returns page-numbered search snippets", () => {
    const id = registerDocument(["Alpha topic", "A useful beta topic appears here"]);

    expect(readDocument(id, { operation: "search", page: null, query: "beta" })).toContain(
      "Page 2:",
    );
  });

  it("fails clearly for invalid pages and removed documents", () => {
    const id = registerDocument(["Only page"]);
    expect(() => readDocument(id, { operation: "page", page: 2, query: null })).toThrow(
      "outside this 1-page document",
    );
    removeDocument(id);
    expect(() => readDocument(id, { operation: "overview", page: null, query: null })).toThrow(
      "Reopen the document",
    );
  });
});
