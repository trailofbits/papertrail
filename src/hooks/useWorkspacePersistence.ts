import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import type { useNotes } from "./useNotes.ts";
import type { usePdfFile } from "./usePdfFile.ts";
import type { useProviderChat } from "./useProviderChat.ts";
import {
  activateStoredWorkspace,
  loadStoredLibrary,
  loadStoredWorkspace,
  saveStoredPdf,
  saveStoredState,
  type StoredDocumentSummary,
  type StoredWorkspace,
  type StoredWorkspaceState,
} from "../lib/workspaceStorage.ts";

type WorkspaceParts = {
  fileState: ReturnType<typeof usePdfFile>;
  noteState: ReturnType<typeof useNotes>;
  chatState: ReturnType<typeof useProviderChat>;
};

type WorkspacePersistence = {
  documents: StoredDocumentSummary[];
  error: string | null;
  switchWorkspace: (workspaceId: string) => Promise<void>;
};

type PersistenceControls = {
  partsRef: RefObject<WorkspaceParts>;
  setDocuments: Dispatch<SetStateAction<StoredDocumentSummary[]>>;
  setStoredWorkspaceId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

function currentWorkspaceState(parts: WorkspaceParts, workspaceId: string): StoredWorkspaceState {
  return {
    workspaceId,
    notes: parts.noteState.notes,
    activeNoteId: parts.noteState.activeNoteId,
    scale: parts.noteState.scale,
    dirty: parts.noteState.dirty,
    globalOpen: parts.noteState.globalOpen,
    defaultProvider: parts.chatState.provider,
    defaultReasoningEffort: parts.chatState.reasoningEffort,
  };
}

function applyWorkspaceState(parts: WorkspaceParts, stored: StoredWorkspace): void {
  parts.noteState.setActiveNoteId(stored.activeNoteId);
  parts.noteState.setScale(stored.scale);
  parts.noteState.setDirty(stored.dirty);
  parts.noteState.setGlobalOpen(stored.globalOpen);
  parts.chatState.setProvider(stored.defaultProvider);
  parts.chatState.setReasoningEffort(stored.defaultReasoningEffort);
}

function persistCurrentWorkspace(parts: WorkspaceParts): void {
  const { workspaceId, pdfBytes, fileName } = parts.fileState;
  if (!workspaceId || !pdfBytes || !fileName) {
    return;
  }
  saveStoredPdf(workspaceId, fileName, pdfBytes);
  saveStoredState(currentWorkspaceState(parts, workspaceId));
}

function useInitialWorkspaceRestore(controls: PersistenceControls): void {
  const restorePromise = useRef<Promise<StoredWorkspace | null> | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!restorePromise.current) {
      const current = controls.partsRef.current;
      restorePromise.current = (async () => {
        const library = loadStoredLibrary();
        controls.setDocuments(library.documents);
        const stored = loadStoredWorkspace();
        if (stored) {
          await current.fileState.restorePdf({
            bytes: stored.pdfBytes,
            fileName: stored.fileName,
            notes: stored.notes,
            workspaceId: stored.workspaceId,
          });
        }
        return stored;
      })();
    }
    void restorePromise.current
      .then((stored) => {
        if (!stored || cancelled) {
          return;
        }
        applyWorkspaceState(controls.partsRef.current, stored);
        controls.setStoredWorkspaceId(stored.workspaceId);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          controls.setError(
            caught instanceof Error ? caught.message : "The saved workspace could not be restored.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [controls]);
}

function usePdfWorkspaceStorage(parts: WorkspaceParts, controls: PersistenceControls): void {
  useEffect(() => {
    if (!parts.fileState.pdfBytes || !parts.fileState.workspaceId || !parts.fileState.fileName) {
      return;
    }
    try {
      const library = saveStoredPdf(
        parts.fileState.workspaceId,
        parts.fileState.fileName,
        parts.fileState.pdfBytes,
      );
      saveStoredState(
        currentWorkspaceState(controls.partsRef.current, parts.fileState.workspaceId),
      );
      controls.setDocuments(library.documents);
      controls.setStoredWorkspaceId(parts.fileState.workspaceId);
      controls.setError(null);
    } catch (caught) {
      controls.setError(
        caught instanceof Error ? caught.message : "The PDF could not be stored locally.",
      );
    }
  }, [controls, parts.fileState.fileName, parts.fileState.pdfBytes, parts.fileState.workspaceId]);
}

function useWorkspaceStateStorage(
  parts: WorkspaceParts,
  storedWorkspaceId: string | null,
  controls: PersistenceControls,
): void {
  useEffect(() => {
    const workspaceId = parts.fileState.workspaceId;
    if (!workspaceId || storedWorkspaceId !== workspaceId) {
      return;
    }
    const timeout = window.setTimeout(() => {
      try {
        saveStoredState(currentWorkspaceState(controls.partsRef.current, workspaceId));
        controls.setError(null);
      } catch (caught) {
        controls.setError(
          caught instanceof Error ? caught.message : "The workspace could not be stored locally.",
        );
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [
    parts.chatState.provider,
    parts.chatState.reasoningEffort,
    parts.fileState.workspaceId,
    parts.noteState.activeNoteId,
    parts.noteState.dirty,
    parts.noteState.globalOpen,
    parts.noteState.notes,
    parts.noteState.scale,
    storedWorkspaceId,
    controls,
  ]);
}

export function useWorkspacePersistence(parts: WorkspaceParts): WorkspacePersistence {
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const [storedWorkspaceId, setStoredWorkspaceId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StoredDocumentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const controls = useMemo(
    () => ({ partsRef, setDocuments, setStoredWorkspaceId, setError }),
    [partsRef],
  );

  useInitialWorkspaceRestore(controls);
  usePdfWorkspaceStorage(parts, controls);
  useWorkspaceStateStorage(parts, storedWorkspaceId, controls);

  async function switchWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === partsRef.current.fileState.workspaceId) {
      return;
    }
    setError(null);
    try {
      persistCurrentWorkspace(partsRef.current);
      const stored = loadStoredWorkspace(workspaceId);
      if (!stored) {
        throw new Error("This PDF is no longer in the local library.");
      }
      await partsRef.current.fileState.restorePdf({
        bytes: stored.pdfBytes,
        fileName: stored.fileName,
        notes: stored.notes,
        workspaceId: stored.workspaceId,
      });
      applyWorkspaceState(partsRef.current, stored);
      const library = activateStoredWorkspace(workspaceId);
      setDocuments(library.documents);
      setStoredWorkspaceId(workspaceId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The PDF could not be switched.");
    }
  }

  return { documents, error, switchWorkspace };
}
