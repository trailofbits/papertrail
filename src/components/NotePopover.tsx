import type {
  NoteMode,
  PdfNote,
  Provider,
  ProviderAvailability,
  ReasoningEffort,
} from "../types.ts";
import { NoteChat } from "./NoteChat.tsx";

type NotePopoverProps = {
  note: PdfNote;
  providers: ProviderAvailability;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onDelete: () => void;
  onModeChange: (mode: NoteMode) => void;
  onNotepadChange: (content: string) => void;
  onProviderChange: (provider: Provider) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  onSend: (prompt: string) => void;
  onToggleContext: (messageId: string) => void;
};

function ModeToggle({
  mode,
  onChange,
}: {
  mode: NoteMode;
  onChange: (mode: NoteMode) => void;
}): React.JSX.Element {
  return (
    <div className="note-mode-toggle" role="tablist" aria-label="Note mode">
      <button
        className={mode === "notepad" ? "is-active" : ""}
        role="tab"
        aria-selected={mode === "notepad"}
        onClick={() => onChange("notepad")}
      >
        Notepad
      </button>
      <button
        className={mode === "chat" ? "is-active" : ""}
        role="tab"
        aria-selected={mode === "chat"}
        onClick={() => onChange("chat")}
      >
        AI chat
      </button>
    </div>
  );
}

function Notepad({
  content,
  onChange,
}: {
  content: string;
  onChange: (content: string) => void;
}): React.JSX.Element {
  return (
    <section className="notepad-panel" role="tabpanel">
      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write a plain note about this passage…"
        aria-label="Plain notepad"
      />
      <p>Always included as context in this note’s AI chat.</p>
    </section>
  );
}

export function NotePopover(props: NotePopoverProps): React.JSX.Element {
  return (
    <aside className="note-popover" aria-label="Highlight note">
      <header className="note-header">
        <div>
          <span className="eyebrow">Page {props.note.pageIndex + 1}</span>
          <h2>Margin note</h2>
        </div>
        <button className="icon-button" onClick={props.onClose} aria-label="Close note">
          ×
        </button>
      </header>
      <blockquote>{props.note.selectedText}</blockquote>
      <ModeToggle mode={props.note.mode} onChange={props.onModeChange} />
      {props.note.mode === "notepad" ? (
        <Notepad content={props.note.notepad} onChange={props.onNotepadChange} />
      ) : (
        <NoteChat {...props} />
      )}
      <button className="delete-note" onClick={props.onDelete}>
        Delete note
      </button>
    </aside>
  );
}
