import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type {
  NoteMessage,
  PdfNote,
  Provider,
  ProviderAvailability,
  ReasoningEffort,
} from "../types.ts";
import { LinkedText } from "./LinkedText.tsx";

type NoteChatProps = {
  note: PdfNote;
  providers: ProviderAvailability;
  busy: boolean;
  error: string | null;
  onProviderChange: (provider: Provider) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  onSend: (prompt: string) => void;
  onToggleContext: (messageId: string) => void;
};

function Message({
  message,
  onToggleContext,
}: {
  message: NoteMessage;
  onToggleContext: (messageId: string) => void;
}): React.JSX.Element {
  return (
    <article className={`message message-${message.role}`}>
      <div className="message-meta">
        <span>{message.role === "assistant" ? "AI" : "You"}</span>
        <button
          className={message.includedInGlobalContext ? "context-button is-added" : "context-button"}
          onClick={() => onToggleContext(message.id)}
          title={
            message.includedInGlobalContext ? "Remove from global context" : "Add to global context"
          }
        >
          {message.includedInGlobalContext ? "In global" : "+ Global"}
        </button>
      </div>
      <div className="message-content">
        {message.role === "assistant" ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ children, href, title }) => (
                <a
                  className="message-link"
                  href={href}
                  title={title}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        ) : (
          <LinkedText text={message.content} />
        )}
      </div>
    </article>
  );
}

function ChatComposer(props: NoteChatProps): React.JSX.Element {
  const [prompt, setPrompt] = useState("");

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || props.busy) {
      return;
    }
    setPrompt("");
    props.onSend(question);
  }

  return (
    <form className="composer" onSubmit={submit}>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            submit(event);
          }
        }}
        placeholder="Ask about this highlight…"
        rows={3}
        aria-label="Ask about this highlight"
      />
      <div className="composer-actions">
        <div className="model-controls">
          <select
            value={props.note.provider}
            onChange={(event) => props.onProviderChange(event.target.value as Provider)}
            aria-label="AI provider"
          >
            <option value="openai" disabled={!props.providers.openai}>
              OpenAI{props.providers.openai ? "" : " · unavailable"}
            </option>
            <option value="anthropic" disabled={!props.providers.anthropic}>
              Claude{props.providers.anthropic ? "" : " · unavailable"}
            </option>
          </select>
          <select
            value={props.note.reasoningEffort}
            onChange={(event) =>
              props.onReasoningEffortChange(event.target.value as ReasoningEffort)
            }
            aria-label="Reasoning effort"
          >
            <option value="low">Low effort</option>
            <option value="medium">Medium effort</option>
            <option value="high">High effort</option>
          </select>
        </div>
        <button className="send-button" disabled={props.busy || !prompt.trim()} type="submit">
          Ask <span>↑</span>
        </button>
      </div>
    </form>
  );
}

export function NoteChat(props: NoteChatProps): React.JSX.Element {
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [props.note.messages, props.busy]);

  return (
    <section className="note-chat" role="tabpanel">
      <div className="message-thread" ref={threadRef}>
        {props.note.messages.length === 0 && (
          <div className="empty-thread">
            <span>✦</span>
            <p>Ask anything. Your plain notepad is included automatically.</p>
          </div>
        )}
        {props.note.messages.map((message) => (
          <Message key={message.id} message={message} onToggleContext={props.onToggleContext} />
        ))}
        {props.busy && <div className="thinking">Reading the passage…</div>}
      </div>
      {props.error && <p className="inline-error">{props.error}</p>}
      <ChatComposer {...props} />
    </section>
  );
}
