import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveStoredPdf, saveStoredState } from "../lib/workspaceStorage.ts";
import { useWorkspacePersistence } from "./useWorkspacePersistence.ts";

const workspaceId = "123e4567-e89b-42d3-a456-426614174000";

beforeEach(() => {
  localStorage.clear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("workspace persistence hook", () => {
  it("restores once under React Strict Mode and reapplies UI state", async () => {
    saveStoredPdf(workspaceId, "stored.pdf", new Uint8Array([1, 2, 3]));
    saveStoredState({
      workspaceId,
      notes: [],
      activeNoteId: "active-note",
      scale: 1.8,
      dirty: true,
      globalOpen: true,
      defaultProvider: "anthropic",
      defaultReasoningEffort: "high",
    });
    const restorePdf = vi.fn<(source: unknown) => Promise<void>>().mockResolvedValue();
    const setActiveNoteId = vi.fn<(value: string | null) => void>();
    const setScale = vi.fn<(value: number) => void>();
    const setDirty = vi.fn<(value: boolean) => void>();
    const setGlobalOpen = vi.fn<(value: boolean) => void>();
    const setProvider = vi.fn<(value: string) => void>();
    const setReasoningEffort = vi.fn<(value: string) => void>();
    const parts = {
      fileState: {
        pdfBytes: null,
        workspaceId: null,
        fileName: "",
        restorePdf,
      },
      noteState: {
        notes: [],
        activeNoteId: null,
        scale: 1.35,
        dirty: false,
        globalOpen: false,
        setActiveNoteId,
        setScale,
        setDirty,
        setGlobalOpen,
      },
      chatState: {
        provider: "openai",
        reasoningEffort: "medium",
        setProvider,
        setReasoningEffort,
      },
    } as unknown as Parameters<typeof useWorkspacePersistence>[0];
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StrictMode>
          <PersistenceHarness parts={parts} />
        </StrictMode>,
      );
      await Promise.resolve();
    });

    expect(restorePdf).toHaveBeenCalledOnce();
    expect(setActiveNoteId).toHaveBeenCalledWith("active-note");
    expect(setScale).toHaveBeenCalledWith(1.8);
    expect(setDirty).toHaveBeenCalledWith(true);
    expect(setGlobalOpen).toHaveBeenCalledWith(true);
    expect(setProvider).toHaveBeenCalledWith("anthropic");
    expect(setReasoningEffort).toHaveBeenCalledWith("high");

    await act(async () => root.unmount());
  });
});

function PersistenceHarness({
  parts,
}: {
  parts: Parameters<typeof useWorkspacePersistence>[0];
}): null {
  useWorkspacePersistence(parts);
  return null;
}
