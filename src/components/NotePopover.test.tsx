import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PdfNote } from "../types.ts";
import { NotePopover } from "./NotePopover.tsx";

const note: PdfNote = {
  id: "note",
  pageIndex: 0,
  provider: "openai",
  reasoningEffort: "medium",
  mode: "chat",
  notepad: "Reader-authored context",
  selectedText: "A highlighted passage",
  surroundingContext: "A paragraph around the highlighted passage.",
  rects: [{ x1: 10, y1: 10, x2: 20, y2: 20 }],
  messages: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("highlight note controls", () => {
  it("renders provider and reasoning effort selectors", () => {
    const markup = renderToStaticMarkup(
      <NotePopover
        note={note}
        providers={{ openai: true, anthropic: true }}
        busy={false}
        error={null}
        onClose={() => undefined}
        onDelete={() => undefined}
        onModeChange={() => undefined}
        onNotepadChange={() => undefined}
        onProviderChange={() => undefined}
        onReasoningEffortChange={() => undefined}
        onSend={() => undefined}
        onToggleContext={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="AI provider"');
    expect(markup).toContain('aria-label="Reasoning effort"');
    expect(markup).toContain('aria-label="Note mode"');
    expect(markup).toContain('<option value="medium" selected="">Medium effort</option>');
  });

  it("renders the PDF-persisted plain notepad", () => {
    const markup = renderToStaticMarkup(
      <NotePopover
        note={{ ...note, mode: "notepad" }}
        providers={{ openai: true, anthropic: true }}
        busy={false}
        error={null}
        onClose={() => undefined}
        onDelete={() => undefined}
        onModeChange={() => undefined}
        onNotepadChange={() => undefined}
        onProviderChange={() => undefined}
        onReasoningEffortChange={() => undefined}
        onSend={() => undefined}
        onToggleContext={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Plain notepad"');
    expect(markup).toContain(note.notepad);
    expect(markup).toContain("Always included as context");
  });
});
