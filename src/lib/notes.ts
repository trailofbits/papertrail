import { z } from "zod";

import type { NoteMessage, PdfNote } from "../types.ts";

export const NOTE_PREFIX = "PAPERTRAIL_NOTE_V2\n";

const rectSchema = z.object({
  x1: z.number().finite(),
  y1: z.number().finite(),
  x2: z.number().finite(),
  y2: z.number().finite(),
});

const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(40_000),
  createdAt: z.string(),
  includedInGlobalContext: z.boolean(),
});

export const noteSchema = z.object({
  id: z.string().min(1),
  pageIndex: z.number().int().nonnegative(),
  provider: z.enum(["openai", "anthropic"]),
  reasoningEffort: z.enum(["low", "medium", "high"]),
  mode: z.enum(["notepad", "chat"]),
  notepad: z.string().max(40_000),
  selectedText: z.string().max(80_000),
  surroundingContext: z.string().max(20_000),
  rects: z.array(rectSchema).min(1).max(1_000),
  messages: z.array(messageSchema).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function encodeNote(note: PdfNote): string {
  return `${NOTE_PREFIX}${JSON.stringify(note)}`;
}

export function decodeNote(contents: string | undefined): PdfNote | null {
  if (!contents?.startsWith(NOTE_PREFIX)) {
    return null;
  }
  const parsed: unknown = JSON.parse(contents.slice(NOTE_PREFIX.length));
  return noteSchema.parse(parsed);
}

export function tryDecodeNote(contents: string | undefined): PdfNote | null {
  try {
    return decodeNote(contents);
  } catch {
    return null;
  }
}

export function globalMessages(notes: PdfNote[]): NoteMessage[] {
  return notes
    .flatMap((note) => note.messages)
    .filter((message) => message.includedInGlobalContext)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}
