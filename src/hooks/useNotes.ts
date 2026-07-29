import { useCallback, useState } from "react";

import type { DraftHighlight, PdfNote, Provider, ReasoningEffort } from "../types.ts";

export function useNotes() {
  const [notes, setNotes] = useState<PdfNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftHighlight | null>(null);
  const [scale, setScale] = useState(1.35);
  const [dirty, setDirty] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(false);
  const activeNote = notes.find((note) => note.id === activeNoteId) ?? null;

  const replaceNotes = useCallback((storedNotes: PdfNote[]) => {
    setNotes(storedNotes);
    setActiveNoteId(null);
    setDraft(null);
    setDirty(false);
  }, []);

  const updateNote = useCallback((noteId: string, update: (note: PdfNote) => PdfNote) => {
    setNotes((current) =>
      current.map((note) =>
        note.id === noteId ? { ...update(note), updatedAt: new Date().toISOString() } : note,
      ),
    );
    setDirty(true);
  }, []);

  function createNote(provider: Provider, reasoningEffort: ReasoningEffort): void {
    if (!draft) {
      return;
    }
    const timestamp = new Date().toISOString();
    const note: PdfNote = {
      id: crypto.randomUUID(),
      pageIndex: draft.pageIndex,
      provider,
      reasoningEffort,
      mode: "chat",
      notepad: "",
      selectedText: draft.selectedText,
      surroundingContext: draft.surroundingContext,
      rects: draft.rects,
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setNotes((current) => [...current, note]);
    setActiveNoteId(note.id);
    setDraft(null);
    setDirty(true);
    window.getSelection()?.removeAllRanges();
  }

  function deleteNote(noteId: string): void {
    setNotes((current) => current.filter((note) => note.id !== noteId));
    setActiveNoteId(null);
    setDirty(true);
  }

  return {
    notes,
    activeNote,
    activeNoteId,
    draft,
    scale,
    dirty,
    globalOpen,
    setActiveNoteId,
    setDraft,
    setScale,
    setGlobalOpen,
    setDirty,
    replaceNotes,
    updateNote,
    createNote,
    deleteNote,
  };
}
