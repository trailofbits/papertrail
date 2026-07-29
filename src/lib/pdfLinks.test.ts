import { AnnotationType, type PDFDocumentProxy } from "pdfjs-dist";
import { describe, expect, it, vi } from "vitest";

import { destinationPageIndex, parsePdfLinks } from "./pdfLinks.ts";

vi.mock("pdfjs-dist", () => ({ AnnotationType: { LINK: 2 } }));

describe("PDF links", () => {
  it("keeps safe external and internal link annotations", () => {
    const links = parsePdfLinks([
      {
        id: "external",
        annotationType: AnnotationType.LINK,
        rect: [10, 20, 30, 40],
        url: "https://example.com/article",
      },
      {
        id: "internal",
        annotationType: AnnotationType.LINK,
        rect: [20, 30, 40, 50],
        dest: "chapter-two",
      },
    ]);

    expect(links).toHaveLength(2);
    expect(links[0]?.url).toBe("https://example.com/article");
    expect(links[1]?.destination).toBe("chapter-two");
  });

  it("rejects unsafe protocols and malformed rectangles", () => {
    expect(
      parsePdfLinks([
        {
          annotationType: AnnotationType.LINK,
          rect: [10, 20, 30, 40],
          url: "javascript:alert(1)",
        },
        {
          annotationType: AnnotationType.LINK,
          rect: [10, 20],
          url: "https://example.com",
        },
      ]),
    ).toEqual([]);
  });

  it("resolves named internal destinations to a page index", async () => {
    const reference = { num: 8, gen: 0 };
    const document = {
      getDestination: vi
        .fn<() => Promise<unknown[]>>()
        .mockResolvedValue([reference, { name: "Fit" }]),
      getPageIndex: vi.fn<() => Promise<number>>().mockResolvedValue(4),
    } as unknown as PDFDocumentProxy;

    await expect(destinationPageIndex(document, "chapter-two")).resolves.toBe(4);
  });
});
