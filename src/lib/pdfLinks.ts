import { AnnotationType, type PDFDocumentProxy } from "pdfjs-dist";

import type { PdfRect } from "../types.ts";

export type PdfLink = {
  id: string;
  rect: PdfRect;
  url: string | null;
  destination: string | unknown[] | null;
};

type AnnotationRecord = Record<string, unknown>;

function externalUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function annotationRect(value: unknown): PdfRect | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite)) {
    return null;
  }
  const [x1, y1, x2, y2] = value as number[];
  return { x1: x1!, y1: y1!, x2: x2!, y2: y2! };
}

export function parsePdfLinks(annotations: unknown[]): PdfLink[] {
  const links: PdfLink[] = [];
  for (const [index, value] of annotations.entries()) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const annotation = value as AnnotationRecord;
    const rect = annotationRect(annotation["rect"]);
    const isLink = annotation["annotationType"] === AnnotationType.LINK;
    const destination = annotation["dest"];
    const hasDestination = typeof destination === "string" || Array.isArray(destination);
    const url = externalUrl(annotation["url"]);
    if (!isLink || !rect || (!url && !hasDestination)) {
      continue;
    }
    links.push({
      id: typeof annotation["id"] === "string" ? annotation["id"] : `link-${index}`,
      rect,
      url,
      destination: hasDestination ? destination : null,
    });
  }
  return links;
}

export async function destinationPageIndex(
  document: PDFDocumentProxy,
  destination: string | unknown[],
): Promise<number | null> {
  const explicit =
    typeof destination === "string" ? await document.getDestination(destination) : destination;
  if (!explicit || explicit.length === 0) {
    return null;
  }
  const reference = explicit[0];
  return typeof reference === "number" ? reference : document.getPageIndex(reference);
}
