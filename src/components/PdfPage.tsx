import { useEffect, useRef, useState } from "react";
import { TextLayer, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist";

import { destinationPageIndex, parsePdfLinks, type PdfLink } from "../lib/pdfLinks.ts";
import { normalizePdfText, surroundingParagraph } from "../lib/textContext.ts";
import type { DraftHighlight, PdfNote, PdfRect } from "../types.ts";

type PdfPageProps = {
  document: PDFDocumentProxy;
  pageIndex: number;
  scale: number;
  notes: PdfNote[];
  activeNoteId: string | null;
  onDraft: (draft: DraftHighlight | null) => void;
  onOpenNote: (noteId: string) => void;
};

type Viewport = ReturnType<PDFPageProxy["getViewport"]>;
type PageLink = PdfLink & { pageIndex: number | null };

function viewportRect(rect: PdfRect, viewport: Viewport): React.CSSProperties {
  const first = viewport.convertToViewportPoint(rect.x1, rect.y1);
  const second = viewport.convertToViewportPoint(rect.x2, rect.y2);
  return {
    left: Math.min(first[0], second[0]),
    top: Math.min(first[1], second[1]),
    width: Math.abs(second[0] - first[0]),
    height: Math.abs(second[1] - first[1]),
  };
}

function selectedRects(
  selection: Selection,
  pageElement: HTMLElement,
  viewport: Viewport,
): PdfRect[] {
  const pageBounds = pageElement.getBoundingClientRect();
  return Array.from(selection.getRangeAt(0).getClientRects())
    .filter((rect) => rect.width > 1 && rect.height > 1)
    .filter((rect) => rect.bottom >= pageBounds.top && rect.top <= pageBounds.bottom)
    .map((rect) => {
      const first = viewport.convertToPdfPoint(
        rect.left - pageBounds.left,
        rect.top - pageBounds.top,
      );
      const second = viewport.convertToPdfPoint(
        rect.right - pageBounds.left,
        rect.bottom - pageBounds.top,
      );
      return {
        x1: Math.min(first[0], second[0]),
        y1: Math.min(first[1], second[1]),
        x2: Math.max(first[0], second[0]),
        y2: Math.max(first[1], second[1]),
      };
    });
}

function useRenderedPage(
  document: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  textRef: React.RefObject<HTMLDivElement | null>,
): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  useEffect(() => {
    let cancelled = false;
    let layer: TextLayer | null = null;
    void (async () => {
      const page = await document.getPage(pageIndex + 1);
      const nextViewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textContainer = textRef.current;
      if (cancelled || !canvas || !textContainer) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(nextViewport.width * ratio);
      canvas.height = Math.floor(nextViewport.height * ratio);
      canvas.style.width = `${nextViewport.width}px`;
      canvas.style.height = `${nextViewport.height}px`;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error(`Could not render page ${pageIndex + 1}.`);
      }
      await page.render({
        canvas,
        canvasContext: context,
        viewport: nextViewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      }).promise;
      textContainer.replaceChildren();
      layer = new TextLayer({
        textContentSource: await page.getTextContent(),
        container: textContainer,
        viewport: nextViewport,
      });
      await layer.render();
      if (!cancelled) {
        setViewport(nextViewport);
      }
    })();
    return () => {
      cancelled = true;
      layer?.cancel();
    };
  }, [canvasRef, document, pageIndex, scale, textRef]);
  return viewport;
}

function usePageLinks(document: PDFDocumentProxy, pageIndex: number): PageLink[] {
  const [links, setLinks] = useState<PageLink[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const page = await document.getPage(pageIndex + 1);
      const parsed = parsePdfLinks(await page.getAnnotations({ intent: "display" }));
      const resolved = await Promise.all(
        parsed.map(async (link) => ({
          ...link,
          pageIndex: link.destination
            ? await destinationPageIndex(document, link.destination)
            : null,
        })),
      );
      if (!cancelled) {
        setLinks(resolved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document, pageIndex]);
  return links;
}

function usePageSelection(
  pageRef: React.RefObject<HTMLDivElement | null>,
  viewport: Viewport | null,
  pageIndex: number,
  onDraft: (draft: DraftHighlight | null) => void,
): void {
  useEffect(() => {
    const pageElement = pageRef.current;
    if (!pageElement || !viewport) {
      return;
    }
    const currentPageElement = pageElement;
    const currentViewport = viewport;
    function handleSelection(): void {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }
      const text = selection.toString().replace(/\s+/g, " ").trim();
      const rects = selectedRects(selection, currentPageElement, currentViewport);
      if (!text || rects.length === 0) {
        return;
      }
      const pageText = normalizePdfText(
        Array.from(currentPageElement.querySelectorAll(".text-layer span"))
          .map((span) => span.textContent ?? "")
          .join(" "),
      );
      const selected = selection.getRangeAt(0).getBoundingClientRect();
      onDraft({
        pageIndex,
        selectedText: text,
        surroundingContext: surroundingParagraph(pageText, text),
        rects,
        position: {
          left: Math.min(selected.right + 10, window.innerWidth - 160),
          top: Math.max(selected.top - 12, 8),
        },
      });
    }
    currentPageElement.addEventListener("mouseup", handleSelection);
    return () => currentPageElement.removeEventListener("mouseup", handleSelection);
  }, [onDraft, pageIndex, pageRef, viewport]);
}

function PageAnnotations({
  notes,
  activeNoteId,
  viewport,
  onOpenNote,
}: {
  notes: PdfNote[];
  activeNoteId: string | null;
  viewport: Viewport;
  onOpenNote: (noteId: string) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="annotation-layer" aria-hidden="true">
        {notes.flatMap((note) =>
          note.rects.map((rect, index) => (
            <span
              className={`highlight ${activeNoteId === note.id ? "is-active" : ""}`}
              key={`${note.id}-${index}`}
              style={viewportRect(rect, viewport)}
            />
          )),
        )}
      </div>
      {notes.map((note) => {
        const anchor = viewportRect(note.rects[0]!, viewport);
        return (
          <button
            className={`note-pin ${activeNoteId === note.id ? "is-active" : ""}`}
            key={note.id}
            style={{
              left: Number(anchor.left) + Number(anchor.width) + 8,
              top: Number(anchor.top) - 3,
            }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onOpenNote(note.id)}
            aria-label={`Open note for “${note.selectedText.slice(0, 50)}”`}
          >
            <span />
          </button>
        );
      })}
    </>
  );
}

function PageLinks({
  links,
  viewport,
}: {
  links: PageLink[];
  viewport: Viewport;
}): React.JSX.Element {
  return (
    <div className="pdf-link-layer">
      {links.map((link) => {
        const href = link.url ?? (link.pageIndex === null ? null : `#page-${link.pageIndex + 1}`);
        return href ? (
          <a
            href={href}
            key={link.id}
            style={viewportRect(link.rect, viewport)}
            target={link.url ? "_blank" : undefined}
            rel={link.url ? "noreferrer noopener" : undefined}
            title={link.url ?? `Go to page ${link.pageIndex! + 1}`}
            aria-label={link.url ? `Open ${link.url}` : `Go to page ${link.pageIndex! + 1}`}
          />
        ) : null;
      })}
    </div>
  );
}

export function PdfPage(props: PdfPageProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const viewport = useRenderedPage(
    props.document,
    props.pageIndex,
    props.scale,
    canvasRef,
    textRef,
  );
  const links = usePageLinks(props.document, props.pageIndex);
  usePageSelection(pageRef, viewport, props.pageIndex, props.onDraft);

  return (
    <section
      className="pdf-page"
      ref={pageRef}
      style={viewport ? { width: viewport.width, height: viewport.height } : undefined}
      aria-label={`PDF page ${props.pageIndex + 1}`}
    >
      <canvas ref={canvasRef} />
      <div className="text-layer" ref={textRef} />
      {viewport && <PageLinks links={links} viewport={viewport} />}
      {viewport && <PageAnnotations {...props} viewport={viewport} />}
      <span className="page-number">{props.pageIndex + 1}</span>
    </section>
  );
}
