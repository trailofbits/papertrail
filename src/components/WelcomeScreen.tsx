import { useRef } from "react";

import type { StoredDocumentSummary } from "../lib/workspaceStorage.ts";

type WelcomeScreenProps = {
  loading: boolean;
  error: string | null;
  documents: StoredDocumentSummary[];
  onOpen: (file: File) => void;
  onSelectDocument: (workspaceId: string) => void;
};

export function WelcomeScreen(props: WelcomeScreenProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <main className="welcome-shell">
      <nav className="brand-bar">
        <div className="brand-mark">P</div>
        <span>Papertrail</span>
        <em>Private by design</em>
      </nav>
      <section className="welcome">
        <div className="welcome-copy">
          <span className="eyebrow">PDF · HIGHLIGHT · CONVERSE</span>
          <h1>
            Read between
            <br />
            <i>the lines.</i>
          </h1>
          <p>
            Turn any highlight into a focused conversation. Your notes and chats travel with the
            PDF—no separate notebook, no lost context.
          </p>
          <button className="open-button" onClick={() => inputRef.current?.click()}>
            <span>Open a PDF</span>
            <b>↗</b>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                props.onOpen(file);
              }
            }}
          />
          {props.documents.length > 0 && (
            <section className="recent-library" aria-label="Recent PDF library">
              <span>Recent library</span>
              {props.documents.slice(0, 4).map((document) => (
                <button
                  key={document.workspaceId}
                  disabled={props.loading}
                  onClick={() => props.onSelectDocument(document.workspaceId)}
                >
                  <span>{document.fileName}</span>
                  <b>→</b>
                </button>
              ))}
            </section>
          )}
          {props.loading && <p className="status-line">Opening document…</p>}
          {props.error && <p className="welcome-error">{props.error}</p>}
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="paper paper-back" />
          <div className="paper paper-front">
            <span className="paper-kicker">THE ART OF ATTENTION</span>
            <i />
            <i />
            <mark />
            <i />
            <i />
            <div className="paper-note">✦ What does the author imply here?</div>
          </div>
          <span className="orbit orbit-one">context</span>
          <span className="orbit orbit-two">ask</span>
        </div>
      </section>
      <footer className="welcome-footer">
        <span>Native PDF annotations</span>
        <span>OpenAI + Claude</span>
        <span>Local-first documents</span>
      </footer>
    </main>
  );
}
