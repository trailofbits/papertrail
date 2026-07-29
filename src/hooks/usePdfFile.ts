import { useState } from "react";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";

import { loadNotesFromPdf, saveNotesToPdf } from "../lib/pdfAnnotations.ts";
import type { PdfNote } from "../types.ts";

type DocumentRegistration = {
  documentId?: string;
  error?: string;
};

type PdfSource = {
  bytes: Uint8Array;
  fileName: string;
  notes: PdfNote[] | null;
  workspaceId: string;
};

function download(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.replace(/\.pdf$/i, "") + "-papertrail.pdf";
  anchor.click();
  URL.revokeObjectURL(url);
}

function textItemString(item: unknown): string {
  if (!item || typeof item !== "object" || !("str" in item)) {
    return "";
  }
  const value = item.str;
  return typeof value === "string" ? value : "";
}

async function extractPages(document: PDFDocumentProxy): Promise<string[]> {
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(textItemString).filter(Boolean).join(" "));
  }
  return pages;
}

async function registerDocument(
  document: PDFDocumentProxy,
  replacesDocumentId: string | null,
): Promise<string> {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pages: await extractPages(document), replacesDocumentId }),
  });
  const body = (await response.json()) as DocumentRegistration;
  if (!response.ok || !body.documentId) {
    throw new Error(body.error ?? "The PDF could not be prepared for AI document reading.");
  }
  return body.documentId;
}

export function usePdfFile(replaceNotes: (notes: PdfNote[]) => void) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyPdfSource(source: PdfSource): Promise<void> {
    const nextPdf = await getDocument({ data: source.bytes.slice() }).promise;
    const [embeddedNotes, nextDocumentId] = await Promise.all([
      source.notes === null ? loadNotesFromPdf(nextPdf) : Promise.resolve(source.notes),
      registerDocument(nextPdf, documentId),
    ]);
    replaceNotes(embeddedNotes);
    setPdf(nextPdf);
    setPdfBytes(source.bytes);
    setDocumentId(nextDocumentId);
    setWorkspaceId(source.workspaceId);
    setFileName(source.fileName);
  }

  async function openPdf(file: File): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await applyPdfSource({
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
        notes: null,
        workspaceId: crypto.randomUUID(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This PDF could not be opened.");
    } finally {
      setLoading(false);
    }
  }

  async function restorePdf(source: PdfSource): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await applyPdfSource(source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The saved PDF could not open.";
      setError(message);
      throw new Error(message, { cause: caught });
    } finally {
      setLoading(false);
    }
  }

  async function savePdf(notes: PdfNote[], onSaved: () => void): Promise<void> {
    if (!pdfBytes) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const saved = await saveNotesToPdf(pdfBytes, notes);
      download(saved, fileName);
      setPdfBytes(saved);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The PDF could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  return {
    pdf,
    pdfBytes,
    documentId,
    workspaceId,
    fileName,
    loading,
    error,
    openPdf,
    restorePdf,
    savePdf,
  };
}
