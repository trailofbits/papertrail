export type Provider = "openai" | "anthropic";
export type ReasoningEffort = "low" | "medium" | "high";
export type NoteMode = "notepad" | "chat";

export type PdfRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type NoteMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  includedInGlobalContext: boolean;
};

export type PdfNote = {
  id: string;
  pageIndex: number;
  provider: Provider;
  reasoningEffort: ReasoningEffort;
  mode: NoteMode;
  notepad: string;
  selectedText: string;
  surroundingContext: string;
  rects: PdfRect[];
  messages: NoteMessage[];
  createdAt: string;
  updatedAt: string;
};

export type DraftHighlight = {
  pageIndex: number;
  selectedText: string;
  surroundingContext: string;
  rects: PdfRect[];
  position: { left: number; top: number };
};

export type ProviderAvailability = Record<Provider, boolean>;
