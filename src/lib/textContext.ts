const CONTEXT_RADIUS = 600;
const SENTENCE_END = /[.!?]\s/g;

export function normalizePdfText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function contextStart(text: string, selectionStart: number, minimum: number): number {
  if (minimum === 0) {
    return 0;
  }
  const match = SENTENCE_END.exec(text.slice(minimum, selectionStart));
  SENTENCE_END.lastIndex = 0;
  return match ? minimum + (match.index ?? 0) + match[0].length : minimum;
}

function contextEnd(text: string, selectionEnd: number, maximum: number): number {
  if (maximum === text.length) {
    return maximum;
  }
  let boundary = selectionEnd;
  for (const match of text.slice(selectionEnd, maximum).matchAll(SENTENCE_END)) {
    boundary = selectionEnd + (match.index ?? 0) + match[0].length;
  }
  return boundary === selectionEnd ? maximum : boundary;
}

export function surroundingParagraph(pageText: string, selectedText: string): string {
  const page = normalizePdfText(pageText);
  const selection = normalizePdfText(selectedText);
  if (!page || !selection) {
    return selection;
  }

  const selectionStart = page.toLocaleLowerCase().indexOf(selection.toLocaleLowerCase());
  if (selectionStart < 0) {
    return selection;
  }

  const selectionEnd = selectionStart + selection.length;
  const minimum = Math.max(0, selectionStart - CONTEXT_RADIUS);
  const maximum = Math.min(page.length, selectionEnd + CONTEXT_RADIUS);
  const start = contextStart(page, selectionStart, minimum);
  const end = contextEnd(page, selectionEnd, maximum);
  return page.slice(start, end).trim();
}
