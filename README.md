# Papertrail

Papertrail is a local-first PDF reader for highlighting passages and discussing them with
OpenAI or Claude. Each highlight opens a pinned margin-note conversation. Individual chat
messages can be added to document-wide context for later notes.

Highlights, conversations, and global-context membership are saved in standard PDF
`/Highlight` annotations. Reopening a saved Papertrail PDF restores the complete workspace,
including each note's plain notepad, active Notepad/AI Chat mode, surrounding paragraph, AI
provider, and reasoning effort. Annotations created by other PDF tools are preserved.

## Run locally

Requirements:

- Node.js 24 LTS
- pnpm 11
- An OpenAI or Anthropic API key

Install and start the app:

```sh
pnpm install --ignore-scripts
pnpm dev
```

Open `http://localhost:4173`, choose a PDF, select text, and click **Ask about this**.
Native PDF hyperlinks remain interactive, including internal page destinations. Web links and
Markdown links in note messages open in a new tab.

The server reads provider settings from `.env`:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6

# Optional
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5
```

Keys remain on the server and are never placed in browser storage or PDF annotations. An AI
request contains the current highlight, roughly one surrounding paragraph, the current note
thread, the complete plain notepad for that highlight, and only the messages the reader
explicitly added to global context. The notepad is included in every AI turn from its note.
The reasoning effort selector maps to the provider's low, medium, or high effort setting.

When a PDF opens, Papertrail extracts its page text into the local server's in-memory document
store. OpenAI or Claude can call the `read_document` tool to inspect a page, search the full
document, or get a page overview. Tool results are sent to the selected provider only when the
model calls the tool. The in-memory copy is replaced when another PDF is opened and is not
written outside the PDF.

## Local recovery

Papertrail keeps a recent-document library in browser `localStorage`. Each PDF has its own
resumable workspace containing the PDF bytes, notes, chats, notepads, active note, unsaved changes,
zoom, drawer state, and default AI settings. Use the library selector in the reader toolbar to
switch documents. Reloading restores the most recently opened PDF. Native PDF annotations remain
the portable copy created by **Save PDF**.

Browser `localStorage` has a small per-site quota and base64 PDF storage adds overhead. If a PDF
does not fit, Papertrail shows a storage error while keeping the current in-memory session
available.

## Saving

**Save PDF** downloads a new `-papertrail.pdf` copy containing the current native annotations.
The browser cannot overwrite the source file automatically. Continue working in the same
session or reopen the downloaded copy later.

## Quality checks

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm audit --audit-level=moderate
```
