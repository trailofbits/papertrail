import { beforeEach, describe, expect, it } from "vitest";

import type { PdfNote } from "../types.ts";
import {
  activateStoredWorkspace,
  loadStoredLibrary,
  loadStoredWorkspace,
  saveStoredPdf,
  saveStoredState,
} from "./workspaceStorage.ts";

const workspaceId = "123e4567-e89b-42d3-a456-426614174000";
const secondWorkspaceId = "223e4567-e89b-42d3-a456-426614174000";
const note: PdfNote = {
  id: "note",
  pageIndex: 0,
  provider: "openai",
  reasoningEffort: "medium",
  mode: "notepad",
  notepad: "Persist this.",
  selectedText: "A passage",
  surroundingContext: "Context around a passage.",
  rects: [{ x1: 10, y1: 20, x2: 30, y2: 40 }],
  messages: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => localStorage.clear());

describe("local workspace storage", () => {
  it("round-trips the PDF and complete resumable state", () => {
    saveStoredPdf(workspaceId, "paper.pdf", new Uint8Array([0, 1, 2, 254, 255]));
    saveStoredState({
      workspaceId,
      notes: [note],
      activeNoteId: note.id,
      scale: 1.5,
      dirty: true,
      globalOpen: true,
      defaultProvider: "openai",
      defaultReasoningEffort: "high",
    });

    expect(loadStoredWorkspace()).toEqual({
      workspaceId,
      fileName: "paper.pdf",
      pdfBytes: new Uint8Array([0, 1, 2, 254, 255]),
      notes: [note],
      activeNoteId: note.id,
      scale: 1.5,
      dirty: true,
      globalOpen: true,
      defaultProvider: "openai",
      defaultReasoningEffort: "high",
    });
  });

  it("rejects incomplete state instead of silently restoring the wrong PDF", () => {
    saveStoredPdf(workspaceId, "paper.pdf", new Uint8Array([1]));

    expect(() => loadStoredWorkspace()).toThrow("incomplete");
  });

  it("keeps separate recent documents and activates a selected workspace", () => {
    saveStoredPdf(workspaceId, "first.pdf", new Uint8Array([1]));
    saveStoredState({
      workspaceId,
      notes: [note],
      activeNoteId: note.id,
      scale: 1.5,
      dirty: true,
      globalOpen: false,
      defaultProvider: "openai",
      defaultReasoningEffort: "medium",
    });
    saveStoredPdf(secondWorkspaceId, "second.pdf", new Uint8Array([2]));
    saveStoredState({
      workspaceId: secondWorkspaceId,
      notes: [],
      activeNoteId: null,
      scale: 1,
      dirty: false,
      globalOpen: true,
      defaultProvider: "anthropic",
      defaultReasoningEffort: "high",
    });

    expect(loadStoredLibrary().documents.map((document) => document.fileName)).toEqual([
      "second.pdf",
      "first.pdf",
    ]);
    expect(loadStoredWorkspace(workspaceId)?.notes).toEqual([note]);

    const library = activateStoredWorkspace(workspaceId);

    expect(library.activeWorkspaceId).toBe(workspaceId);
    expect(library.documents.map((document) => document.fileName)).toEqual([
      "first.pdf",
      "second.pdf",
    ]);
  });
});
