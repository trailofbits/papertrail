import { describe, expect, it } from "vitest";

import type { PdfNote } from "../types.ts";
import { decodeNote, encodeNote, globalMessages, tryDecodeNote } from "./notes.ts";

const note: PdfNote = {
  id: "note-1",
  pageIndex: 0,
  provider: "openai",
  reasoningEffort: "medium",
  mode: "notepad",
  notepad: "Remember the earlier definition.",
  selectedText: "A useful passage",
  surroundingContext: "The paragraph around a useful passage.",
  rects: [{ x1: 10, y1: 20, x2: 40, y2: 30 }],
  messages: [
    {
      id: "message-1",
      role: "assistant",
      content: "An explanation",
      createdAt: "2026-01-01T00:00:00.000Z",
      includedInGlobalContext: true,
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PDF note payloads", () => {
  it("round-trips a note through annotation contents", () => {
    expect(decodeNote(encodeNote(note))).toEqual(note);
  });

  it("ignores unrelated and malformed annotations", () => {
    expect(tryDecodeNote("ordinary PDF comment")).toBeNull();
    expect(tryDecodeNote("PAPERTRAIL_NOTE_V2\n{broken")).toBeNull();
  });

  it("collects only messages selected for global context", () => {
    const excluded = {
      ...note,
      id: "note-2",
      messages: [{ ...note.messages[0]!, id: "message-2", includedInGlobalContext: false }],
    };
    expect(globalMessages([excluded, note])).toEqual(note.messages);
  });
});
