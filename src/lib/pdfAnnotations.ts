import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";

import type { PdfNote, PdfRect } from "../types.ts";
import { encodeNote, tryDecodeNote } from "./notes.ts";

const APP_MARKER = "papertrail:";
const ANNOTATIONS = PDFName.of("Annots");
const NAME = PDFName.of("NM");

type AnnotationRecord = Record<string, unknown>;

function annotationText(annotation: unknown): string | undefined {
  if (!annotation || typeof annotation !== "object") {
    return undefined;
  }
  const record = annotation as AnnotationRecord;
  const contents = record["contentsObj"];
  if (contents && typeof contents === "object") {
    const value = (contents as AnnotationRecord)["str"];
    if (typeof value === "string") {
      return value;
    }
  }
  return typeof record["contents"] === "string" ? record["contents"] : undefined;
}

export async function loadNotesFromPdf(document: PDFDocumentProxy): Promise<PdfNote[]> {
  const notes: PdfNote[] = [];
  for (let pageIndex = 0; pageIndex < document.numPages; pageIndex += 1) {
    const page = await document.getPage(pageIndex + 1);
    const annotations = (await page.getAnnotations({ intent: "display" })) as unknown[];
    for (const annotation of annotations) {
      const note = tryDecodeNote(annotationText(annotation));
      if (note) {
        notes.push({ ...note, pageIndex });
      }
    }
  }
  return notes.sort((left, right) => {
    if (left.pageIndex !== right.pageIndex) {
      return left.pageIndex - right.pageIndex;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}

function annotationIsOurs(dictionary: PDFDict): boolean {
  const marker = dictionary.lookupMaybe(NAME, PDFString, PDFHexString);
  return marker?.decodeText().startsWith(APP_MARKER) ?? false;
}

function annotationsWithoutPapertrail(document: PDFDocument, pageIndex: number): PDFArray {
  const page = document.getPage(pageIndex);
  const existing = page.node.lookupMaybe(ANNOTATIONS, PDFArray);
  const filtered = PDFArray.withContext(document.context);
  if (!existing) {
    return filtered;
  }

  for (const object of existing.asArray()) {
    const dictionary = document.context.lookupMaybe(object, PDFDict);
    if (!dictionary || !annotationIsOurs(dictionary)) {
      filtered.push(object);
    }
  }
  return filtered;
}

function boundingRect(rects: PdfRect[]): PdfRect {
  return rects.reduce(
    (bounds, rect) => ({
      x1: Math.min(bounds.x1, rect.x1),
      y1: Math.min(bounds.y1, rect.y1),
      x2: Math.max(bounds.x2, rect.x2),
      y2: Math.max(bounds.y2, rect.y2),
    }),
    { ...rects[0]! },
  );
}

function quadPoints(rects: PdfRect[]): number[] {
  return rects.flatMap((rect) => [
    rect.x1,
    rect.y2,
    rect.x2,
    rect.y2,
    rect.x1,
    rect.y1,
    rect.x2,
    rect.y1,
  ]);
}

function addNoteAnnotation(document: PDFDocument, note: PdfNote, annotations: PDFArray): void {
  const bounds = boundingRect(note.rects);
  const page = document.getPage(note.pageIndex);
  const dictionary = document.context.obj({
    Type: "Annot",
    Subtype: "Highlight",
    Rect: [bounds.x1, bounds.y1, bounds.x2, bounds.y2],
    QuadPoints: quadPoints(note.rects),
    C: [0.98, 0.76, 0.18],
    CA: 0.38,
    F: 4,
    P: page.ref,
    NM: PDFHexString.fromText(`${APP_MARKER}${note.id}`),
    T: PDFHexString.fromText("Papertrail AI"),
    Contents: PDFHexString.fromText(encodeNote(note)),
    M: PDFString.fromDate(new Date(note.updatedAt)),
  });
  annotations.push(document.context.register(dictionary));
}

export async function saveNotesToPdf(
  originalBytes: Uint8Array,
  notes: PdfNote[],
): Promise<Uint8Array> {
  const document = await PDFDocument.load(originalBytes, { updateMetadata: false });
  const byPage = new Map<number, PdfNote[]>();
  for (const note of notes) {
    const pageNotes = byPage.get(note.pageIndex) ?? [];
    pageNotes.push(note);
    byPage.set(note.pageIndex, pageNotes);
  }

  for (let pageIndex = 0; pageIndex < document.getPageCount(); pageIndex += 1) {
    const annotations = annotationsWithoutPapertrail(document, pageIndex);
    for (const note of byPage.get(pageIndex) ?? []) {
      addNoteAnnotation(document, note, annotations);
    }
    const page = document.getPage(pageIndex);
    if (annotations.size() > 0) {
      page.node.set(ANNOTATIONS, annotations);
    } else {
      page.node.delete(ANNOTATIONS);
    }
  }
  return document.save({ addDefaultPage: false, useObjectStreams: false });
}
