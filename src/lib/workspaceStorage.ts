import { z } from "zod";

import type { PdfNote, Provider, ReasoningEffort } from "../types.ts";
import { noteSchema } from "./notes.ts";

const LIBRARY_STORAGE_KEY = "papertrail.library.v1";
const BYTE_CHUNK_SIZE = 32_768;

const storedDocumentSchema = z.object({
  workspaceId: z.string().uuid(),
  fileName: z.string().min(1).max(1_000),
  lastOpenedAt: z.string().datetime(),
});

const storedLibrarySchema = z.object({
  version: z.literal(1),
  activeWorkspaceId: z.string().uuid().nullable(),
  documents: z.array(storedDocumentSchema),
});

const storedPdfSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().uuid(),
  fileName: z.string().min(1).max(1_000),
  data: z.string().min(1),
});

const storedStateSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().uuid(),
  notes: z.array(noteSchema),
  activeNoteId: z.string().nullable(),
  scale: z.number().min(0.5).max(3),
  dirty: z.boolean(),
  globalOpen: z.boolean(),
  defaultProvider: z.enum(["openai", "anthropic"]),
  defaultReasoningEffort: z.enum(["low", "medium", "high"]),
});

export type StoredDocumentSummary = z.infer<typeof storedDocumentSchema>;

export type StoredLibrary = {
  activeWorkspaceId: string | null;
  documents: StoredDocumentSummary[];
};

export type StoredWorkspaceState = {
  workspaceId: string;
  notes: PdfNote[];
  activeNoteId: string | null;
  scale: number;
  dirty: boolean;
  globalOpen: boolean;
  defaultProvider: Provider;
  defaultReasoningEffort: ReasoningEffort;
};

export type StoredWorkspace = StoredWorkspaceState & {
  fileName: string;
  pdfBytes: Uint8Array;
};

function pdfStorageKey(workspaceId: string): string {
  return `papertrail.workspace.${workspaceId}.pdf.v1`;
}

function stateStorageKey(workspaceId: string): string {
  return `papertrail.workspace.${workspaceId}.state.v1`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BYTE_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BYTE_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function storageWrite(key: string, value: unknown, label: string): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    const message =
      `Could not save ${label} in localStorage. ` +
      "The PDF library may exceed the browser's storage quota.";
    throw new Error(message, { cause: error });
  }
}

function saveLibrary(library: StoredLibrary): void {
  storageWrite(LIBRARY_STORAGE_KEY, { version: 1, ...library }, "the PDF library");
}

export function loadStoredLibrary(): StoredLibrary {
  const value = localStorage.getItem(LIBRARY_STORAGE_KEY);
  if (value === null) {
    return { activeWorkspaceId: null, documents: [] };
  }
  try {
    const library = storedLibrarySchema.parse(JSON.parse(value) as unknown);
    return {
      activeWorkspaceId: library.activeWorkspaceId,
      documents: library.documents,
    };
  } catch (error) {
    throw new Error("The saved PDF library is invalid.", { cause: error });
  }
}

function touchStoredDocument(workspaceId: string, fileName: string): StoredLibrary {
  const library = loadStoredLibrary();
  const document = {
    workspaceId,
    fileName,
    lastOpenedAt: new Date().toISOString(),
  };
  const next = {
    activeWorkspaceId: workspaceId,
    documents: [document, ...library.documents.filter((item) => item.workspaceId !== workspaceId)],
  };
  saveLibrary(next);
  return next;
}

export function activateStoredWorkspace(workspaceId: string): StoredLibrary {
  const library = loadStoredLibrary();
  const document = library.documents.find((item) => item.workspaceId === workspaceId);
  if (!document) {
    throw new Error("This PDF is no longer in the local library.");
  }
  return touchStoredDocument(workspaceId, document.fileName);
}

export function saveStoredPdf(
  workspaceId: string,
  fileName: string,
  pdfBytes: Uint8Array,
): StoredLibrary {
  storageWrite(
    pdfStorageKey(workspaceId),
    {
      version: 1,
      workspaceId,
      fileName,
      data: bytesToBase64(pdfBytes),
    },
    `the PDF "${fileName}"`,
  );
  return touchStoredDocument(workspaceId, fileName);
}

export function saveStoredState(state: StoredWorkspaceState): void {
  storageWrite(
    stateStorageKey(state.workspaceId),
    { version: 1, ...state },
    "the document workspace",
  );
}

function parseStoredValues(pdfValue: string, stateValue: string): StoredWorkspace {
  try {
    const pdf = storedPdfSchema.parse(JSON.parse(pdfValue) as unknown);
    const state = storedStateSchema.parse(JSON.parse(stateValue) as unknown);
    if (pdf.workspaceId !== state.workspaceId) {
      throw new Error("The saved PDF and workspace do not match.");
    }
    return {
      workspaceId: state.workspaceId,
      notes: state.notes,
      activeNoteId: state.activeNoteId,
      scale: state.scale,
      dirty: state.dirty,
      globalOpen: state.globalOpen,
      defaultProvider: state.defaultProvider,
      defaultReasoningEffort: state.defaultReasoningEffort,
      fileName: pdf.fileName,
      pdfBytes: base64ToBytes(pdf.data),
    };
  } catch (error) {
    throw new Error("The saved document workspace is invalid. Open the PDF again to replace it.", {
      cause: error,
    });
  }
}

export function loadStoredWorkspace(workspaceId?: string): StoredWorkspace | null {
  const library = loadStoredLibrary();
  const selectedWorkspaceId = workspaceId ?? library.activeWorkspaceId;
  if (selectedWorkspaceId === null) {
    return null;
  }
  if (!library.documents.some((document) => document.workspaceId === selectedWorkspaceId)) {
    throw new Error("This PDF is no longer in the local library.");
  }
  const pdfValue = localStorage.getItem(pdfStorageKey(selectedWorkspaceId));
  const stateValue = localStorage.getItem(stateStorageKey(selectedWorkspaceId));
  if (pdfValue === null || stateValue === null) {
    throw new Error(
      "The saved document workspace is incomplete. Open the PDF again to replace it.",
    );
  }
  return parseStoredValues(pdfValue, stateValue);
}
