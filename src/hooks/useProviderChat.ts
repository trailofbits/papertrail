import { useEffect, useMemo, useState } from "react";

import { globalMessages } from "../lib/notes.ts";
import type {
  NoteMessage,
  PdfNote,
  Provider,
  ProviderAvailability,
  ReasoningEffort,
} from "../types.ts";

const EMPTY_PROVIDERS: ProviderAvailability = { openai: false, anthropic: false };

function newMessage(role: NoteMessage["role"], content: string): NoteMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    includedInGlobalContext: false,
  };
}

export function useProviderChat(
  documentId: string | null,
  notes: PdfNote[],
  updateNote: (noteId: string, update: (note: PdfNote) => PdfNote) => void,
) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("medium");
  const [providers, setProviders] = useState(EMPTY_PROVIDERS);
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contextMessages = useMemo(() => globalMessages(notes), [notes]);

  useEffect(() => {
    void fetch("/api/config")
      .then(async (response) => (await response.json()) as { providers: ProviderAvailability })
      .then(({ providers: available }) => {
        setProviders(available);
        if (!available.openai && available.anthropic) {
          setProvider("anthropic");
        }
      })
      .catch(() => setProviders(EMPTY_PROVIDERS));
  }, []);

  async function sendMessage(note: PdfNote, prompt: string): Promise<void> {
    if (!documentId) {
      setError("The PDF is not ready for AI document reading. Reopen it and try again.");
      return;
    }
    const userMessage = newMessage("user", prompt);
    setError(null);
    setBusyNoteId(note.id);
    updateNote(note.id, (current) => ({
      ...current,
      messages: [...current.messages, userMessage],
    }));
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: note.provider,
          documentId,
          selectedText: note.selectedText,
          surroundingContext: note.surroundingContext,
          notepadContext: note.notepad,
          reasoningEffort: note.reasoningEffort,
          messages: note.messages.map(({ role, content }) => ({ role, content })),
          globalContext: contextMessages.map(({ role, content }) => ({ role, content })),
          prompt,
        }),
      });
      const body = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !body.answer) {
        throw new Error(body.error ?? "The AI request failed.");
      }
      updateNote(note.id, (current) => ({
        ...current,
        messages: [...current.messages, newMessage("assistant", body.answer!)],
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The AI request failed.");
    } finally {
      setBusyNoteId(null);
    }
  }

  return {
    provider,
    reasoningEffort,
    providers,
    busyNoteId,
    error,
    contextMessages,
    setProvider,
    setReasoningEffort,
    clearError: () => setError(null),
    sendMessage,
  };
}
