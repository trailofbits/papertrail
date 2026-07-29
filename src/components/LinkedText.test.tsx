import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LinkedText } from "./LinkedText.tsx";

describe("chat message links", () => {
  it("renders bare and Markdown web links as safe anchors", () => {
    const markup = renderToStaticMarkup(
      <LinkedText text="Read [the source](https://example.com/source) or https://openai.com." />,
    );

    expect(markup).toContain('href="https://example.com/source"');
    expect(markup).toContain(">the source</a>");
    expect(markup).toContain('href="https://openai.com"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer noopener"');
  });

  it("leaves non-web protocols as plain text", () => {
    const markup = renderToStaticMarkup(<LinkedText text="Do not open javascript:alert(1)" />);

    expect(markup).not.toContain("<a");
    expect(markup).toContain("javascript:alert(1)");
  });
});
