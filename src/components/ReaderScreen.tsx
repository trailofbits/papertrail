import { useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import type { StoredDocumentSummary } from "../lib/workspaceStorage.ts";
import type {
  DraftHighlight,
  NoteMessage,
  NoteMode,
  PdfNote,
  Provider,
  ProviderAvailability,
  ReasoningEffort,
} from "../types.ts";
import { NotePopover } from "./NotePopover.tsx";
import { PdfPage } from "./PdfPage.tsx";

type ReaderScreenProps = {
  pdf: PDFDocumentProxy;
  workspaceId: string | null;
  fileName: string;
  documents: StoredDocumentSummary[];
  notes: PdfNote[];
  activeNote: PdfNote | null;
  activeNoteId: string | null;
  draft: DraftHighlight | null;
  scale: number;
  dirty: boolean;
  globalOpen: boolean;
  contextMessages: NoteMessage[];
  providers: ProviderAvailability;
  busyNoteId: string | null;
  error: string | null;
  loading: boolean;
  onOpen: (file: File) => void;
  onSelectDocument: (workspaceId: string) => void;
  onSave: () => void;
  onCreateNote: () => void;
  onDeleteNote: (noteId: string) => void;
  onSetDraft: (draft: DraftHighlight | null) => void;
  onSetScale: React.Dispatch<React.SetStateAction<number>>;
  onSetGlobalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSetActiveNote: (noteId: string | null) => void;
  onSetProvider: (provider: Provider) => void;
  onSetReasoningEffort: (effort: ReasoningEffort) => void;
  onSetNoteMode: (noteId: string, mode: NoteMode) => void;
  onSetNotepad: (noteId: string, content: string) => void;
  onSend: (note: PdfNote, prompt: string) => void;
  onToggleContext: (noteId: string, messageId: string) => void;
};

function Toolbar(props: ReaderScreenProps): React.JSX.Element {
  return (
    <header className="reader-toolbar">
      <div className="brand-compact">
        <div className="brand-mark">P</div>
        <strong>Papertrail</strong>
      </div>
      <div className="document-title">
        <label>
          <span>Library</span>
          <select
            aria-label="Switch PDF"
            value={props.workspaceId ?? ""}
            disabled={props.loading || props.busyNoteId !== null}
            onChange={(event) => props.onSelectDocument(event.target.value)}
          >
            {!props.documents.some((document) => document.workspaceId === props.workspaceId) && (
              <option value={props.workspaceId ?? ""}>{props.fileName}</option>
            )}
            {props.documents.map((document) => (
              <option key={document.workspaceId} value={document.workspaceId}>
                {document.fileName}
              </option>
            ))}
          </select>
        </label>
        <small>
          {props.pdf.numPages} pages · {props.notes.length}{" "}
          {props.notes.length === 1 ? "note" : "notes"}
        </small>
      </div>
      <div className="toolbar-actions">
        <button onClick={() => props.onSetGlobalOpen((current) => !current)}>
          Context <b>{props.contextMessages.length}</b>
        </button>
        <div className="zoom-control">
          <button onClick={() => props.onSetScale((value) => Math.max(0.75, value - 0.15))}>
            −
          </button>
          <span>{Math.round(props.scale * 100)}%</span>
          <button onClick={() => props.onSetScale((value) => Math.min(2.4, value + 0.15))}>
            +
          </button>
        </div>
        <button className="save-button" onClick={props.onSave} disabled={props.loading}>
          {props.dirty ? "Save PDF ·" : "Save PDF"} <span>↓</span>
        </button>
      </div>
    </header>
  );
}

function PageRail({
  pageCount,
  onOpen,
}: {
  pageCount: number;
  onOpen: (file: File) => void;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <aside className="page-rail">
      <button className="new-document" onClick={() => inputRef.current?.click()}>
        +
      </button>
      <div className="page-track">
        {Array.from({ length: pageCount }, (_, index) => (
          <a href={`#page-${index + 1}`} key={index}>
            {index + 1}
          </a>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onOpen(file);
          }
        }}
      />
    </aside>
  );
}

function DocumentPages(props: ReaderScreenProps): React.JSX.Element {
  return (
    <div className="page-scroller">
      <div className="selection-hint">Select text to start a note</div>
      {Array.from({ length: props.pdf.numPages }, (_, pageIndex) => (
        <div id={`page-${pageIndex + 1}`} key={pageIndex}>
          <PdfPage
            document={props.pdf}
            pageIndex={pageIndex}
            scale={props.scale}
            notes={props.notes.filter((note) => note.pageIndex === pageIndex)}
            activeNoteId={props.activeNoteId}
            onDraft={props.onSetDraft}
            onOpenNote={(noteId) => props.onSetActiveNote(noteId)}
          />
        </div>
      ))}
    </div>
  );
}

function GlobalDrawer({
  messages,
  onClose,
}: {
  messages: NoteMessage[];
  onClose: () => void;
}): React.JSX.Element {
  return (
    <aside className="global-drawer">
      <header>
        <div>
          <span className="eyebrow">DOCUMENT MEMORY</span>
          <h2>Global context</h2>
        </div>
        <button className="icon-button" onClick={onClose}>
          ×
        </button>
      </header>
      <p className="drawer-intro">These messages are sent to the AI in every future margin note.</p>
      {messages.length === 0 ? (
        <div className="drawer-empty">Add a message with its “+ Global” button.</div>
      ) : (
        messages.map((message) => (
          <article key={message.id}>
            <span>{message.role === "assistant" ? "AI" : "You"}</span>
            <p>{message.content}</p>
          </article>
        ))
      )}
    </aside>
  );
}

function ReaderPanels(props: ReaderScreenProps): React.JSX.Element {
  return (
    <>
      {props.activeNote && (
        <NotePopover
          note={props.activeNote}
          providers={props.providers}
          busy={props.busyNoteId === props.activeNote.id}
          error={props.error}
          onClose={() => props.onSetActiveNote(null)}
          onDelete={() => props.onDeleteNote(props.activeNote!.id)}
          onModeChange={(mode) => props.onSetNoteMode(props.activeNote!.id, mode)}
          onNotepadChange={(content) => props.onSetNotepad(props.activeNote!.id, content)}
          onProviderChange={props.onSetProvider}
          onReasoningEffortChange={props.onSetReasoningEffort}
          onSend={(prompt) => props.onSend(props.activeNote!, prompt)}
          onToggleContext={(messageId) => props.onToggleContext(props.activeNote!.id, messageId)}
        />
      )}
      {props.globalOpen && (
        <GlobalDrawer
          messages={props.contextMessages}
          onClose={() => props.onSetGlobalOpen(false)}
        />
      )}
      {props.draft && (
        <button
          className="ask-selection"
          style={{ left: props.draft.position.left, top: props.draft.position.top }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            props.onCreateNote();
          }}
        >
          <span>✦</span> Ask about this
        </button>
      )}
    </>
  );
}

export function ReaderScreen(props: ReaderScreenProps): React.JSX.Element {
  return (
    <main className="reader-shell">
      <Toolbar {...props} />
      <section className="reader-body">
        <PageRail pageCount={props.pdf.numPages} onOpen={props.onOpen} />
        <DocumentPages {...props} />
        <ReaderPanels {...props} />
      </section>
    </main>
  );
}
