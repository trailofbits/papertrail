import { describe, expect, it } from "vitest";

import { normalizePdfText, surroundingParagraph } from "./textContext.ts";

describe("PDF text context", () => {
  it("normalizes whitespace from PDF text layers", () => {
    expect(normalizePdfText("One\n  two\tthree")).toBe("One two three");
  });

  it("keeps the selected sentence and nearby paragraph context", () => {
    const page =
      "Earlier material ends here. The relevant paragraph begins. " +
      "The highlighted idea is useful. It also has a consequence. Later material follows.";

    expect(surroundingParagraph(page, "highlighted idea")).toBe(
      "Earlier material ends here. The relevant paragraph begins. " +
        "The highlighted idea is useful. It also has a consequence. Later material follows.",
    );
  });

  it("falls back to the selection when PDF extraction cannot locate it", () => {
    expect(surroundingParagraph("Different extracted text", "Selected ligature")).toBe(
      "Selected ligature",
    );
  });
});
