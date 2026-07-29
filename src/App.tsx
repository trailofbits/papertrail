import { useEffect } from "react";
import { GlobalWorkerOptions } from "pdfjs-dist";

import { ReaderScreen } from "./components/ReaderScreen.tsx";
import { WelcomeScreen } from "./components/WelcomeScreen.tsx";
import { useNotes } from "./hooks/useNotes.ts";
import { usePdfFile } from "./hooks/usePdfFile.ts";
import { useProviderChat } from "./hooks/useProviderChat.ts";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence.ts";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function App(): React.JSX.Element {
  const noteState = useNotes();
  const fileState = usePdfFile(noteState.replaceNotes);
  const chatState = useProviderChat(fileState.documentId, noteState.notes, noteState.updateNote);
  const workspace = useWorkspacePersistence({ fileState, noteState, chatState });
  const { setDraft } = noteState;

  useEffect(() => {
    function dismissDraft(event: MouseEvent): void {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".ask-selection")) {
        setDraft(null);
      }
    }
    document.addEventListener("mousedown", dismissDraft);
    return () => document.removeEventListener("mousedown", dismissDraft);
  }, [setDraft]);

  if (!fileState.pdf) {
    return (
      <WelcomeScreen
        loading={fileState.loading}
        error={workspace.error ?? fileState.error}
        documents={workspace.documents}
        onOpen={(file) => void fileState.openPdf(file)}
        onSelectDocument={(workspaceId) => void workspace.switchWorkspace(workspaceId)}
      />
    );
  }

  return (
    <ReaderScreen
      pdf={fileState.pdf}
      workspaceId={fileState.workspaceId}
      fileName={fileState.fileName}
      documents={workspace.documents}
      notes={noteState.notes}
      activeNote={noteState.activeNote}
      activeNoteId={noteState.activeNoteId}
      draft={noteState.draft}
      scale={noteState.scale}
      dirty={noteState.dirty}
      globalOpen={noteState.globalOpen}
      contextMessages={chatState.contextMessages}
      providers={chatState.providers}
      busyNoteId={chatState.busyNoteId}
      error={chatState.error ?? workspace.error ?? fileState.error}
      loading={fileState.loading}
      onOpen={(file) => void fileState.openPdf(file)}
      onSelectDocument={(workspaceId) => void workspace.switchWorkspace(workspaceId)}
      onSave={() => void fileState.savePdf(noteState.notes, () => noteState.setDirty(false))}
      onCreateNote={() => noteState.createNote(chatState.provider, chatState.reasoningEffort)}
      onDeleteNote={noteState.deleteNote}
      onSetDraft={noteState.setDraft}
      onSetScale={noteState.setScale}
      onSetGlobalOpen={noteState.setGlobalOpen}
      onSetActiveNote={(noteId) => {
        chatState.clearError();
        noteState.setActiveNoteId(noteId);
      }}
      onSetProvider={(provider) => {
        chatState.setProvider(provider);
        if (noteState.activeNoteId) {
          noteState.updateNote(noteState.activeNoteId, (note) => ({ ...note, provider }));
        }
      }}
      onSetReasoningEffort={(reasoningEffort) => {
        chatState.setReasoningEffort(reasoningEffort);
        if (noteState.activeNoteId) {
          noteState.updateNote(noteState.activeNoteId, (note) => ({
            ...note,
            reasoningEffort,
          }));
        }
      }}
      onSetNoteMode={(noteId, mode) => noteState.updateNote(noteId, (note) => ({ ...note, mode }))}
      onSetNotepad={(noteId, notepad) =>
        noteState.updateNote(noteId, (note) => ({ ...note, notepad }))
      }
      onSend={(note, prompt) => void chatState.sendMessage(note, prompt)}
      onToggleContext={(noteId, messageId) =>
        noteState.updateNote(noteId, (note) => ({
          ...note,
          messages: note.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  includedInGlobalContext: !message.includedInGlobalContext,
                }
              : message,
          ),
        }))
      }
    />
  );
}
