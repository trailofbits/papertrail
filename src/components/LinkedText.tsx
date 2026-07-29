const LINK_PATTERN =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()\]]*[^\s<>()\].,!?:;])/g;

export function LinkedText({ text }: { text: string }): React.JSX.Element {
  const content: React.ReactNode[] = [];
  let cursor = 0;
  for (const [index, match] of Array.from(text.matchAll(LINK_PATTERN)).entries()) {
    const start = match.index ?? 0;
    if (start > cursor) {
      content.push(text.slice(cursor, start));
    }
    const href = match[2] ?? match[3]!;
    content.push(
      <a
        className="message-link"
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        key={`link-${index}-${start}`}
      >
        {match[1] ?? href}
      </a>,
    );
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    content.push(text.slice(cursor));
  }
  return <>{content}</>;
}
