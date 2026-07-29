import { PDFArray, PDFDocument, PDFHexString, PDFName } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";

import type { PdfNote } from "../types.ts";
import { loadNotesFromPdf, saveNotesToPdf } from "./pdfAnnotations.ts";

const note: PdfNote = {
  id: "native-note",
  pageIndex: 0,
  provider: "anthropic",
  reasoningEffort: "high",
  mode: "chat",
  notepad: "Connect this passage to the introduction.",
  selectedText: "Portable context",
  surroundingContext: "The surrounding paragraph provides portable context.",
  rects: [{ x1: 40, y1: 70, x2: 160, y2: 84 }],
  messages: [
    {
      id: "native-message",
      role: "assistant",
      content: "This travels in the PDF.",
      createdAt: "2026-01-01T00:00:00.000Z",
      includedInGlobalContext: true,
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

async function pdfWithExistingAnnotation(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([300, 400]);
  const annotation = document.context.obj({
    Type: "Annot",
    Subtype: "Text",
    Rect: [20, 20, 40, 40],
    Contents: PDFHexString.fromText("An unrelated comment"),
  });
  const annotations = PDFArray.withContext(document.context);
  annotations.push(document.context.register(annotation));
  page.node.set(PDFName.of("Annots"), annotations);
  return document.save({ useObjectStreams: false });
}

async function readAnnotations(bytes: Uint8Array): Promise<{
  document: Awaited<ReturnType<typeof getDocument>["promise"]>;
  annotations: unknown[];
}> {
  const document = await getDocument({ data: bytes.slice() }).promise;
  const page = await document.getPage(1);
  const annotations = (await page.getAnnotations()) as unknown[];
  return { document, annotations };
}

describe("native PDF annotation persistence", () => {
  it("round-trips notes and preserves annotations created by other tools", async () => {
    const original = await pdfWithExistingAnnotation();
    const firstSave = await saveNotesToPdf(original, [note]);
    const firstRead = await readAnnotations(firstSave);

    expect(firstRead.annotations).toHaveLength(2);
    expect(await loadNotesFromPdf(firstRead.document)).toEqual([note]);

    const updated = {
      ...note,
      selectedText: "Updated portable context",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const secondSave = await saveNotesToPdf(firstSave, [updated]);
    const secondRead = await readAnnotations(secondSave);

    expect(secondRead.annotations).toHaveLength(2);
    expect(await loadNotesFromPdf(secondRead.document)).toEqual([updated]);
  });
});
