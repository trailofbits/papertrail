import { describe, expect, it, vi } from "vitest";

import { installReadableStreamAsyncIterator } from "./readableStreamCompat.ts";

class PartialReadableStream<T> {
  readonly #values: T[];
  readonly cancel = vi.fn<() => Promise<void>>().mockResolvedValue();
  readonly releaseLock = vi.fn<() => void>();

  constructor(values: T[]) {
    this.#values = [...values];
  }

  getReader() {
    return {
      read: async () => {
        const value = this.#values.shift();
        return value === undefined ? { done: true as const } : { done: false as const, value };
      },
      cancel: this.cancel,
      releaseLock: this.releaseLock,
    };
  }
}

describe("ReadableStream compatibility", () => {
  it("adds async iteration to partial Safari-style streams", async () => {
    const constructor = PartialReadableStream as unknown as typeof ReadableStream;
    expect(installReadableStreamAsyncIterator(constructor)).toBe(true);
    const stream = new PartialReadableStream([1, 2, 3]);
    const values: number[] = [];

    for await (const value of stream as unknown as AsyncIterable<number>) {
      values.push(value);
    }

    expect(values).toEqual([1, 2, 3]);
    expect(stream.cancel).not.toHaveBeenCalled();
    expect(stream.releaseLock).toHaveBeenCalledOnce();
  });

  it("cancels the reader when iteration stops early", async () => {
    const constructor = PartialReadableStream as unknown as typeof ReadableStream;
    installReadableStreamAsyncIterator(constructor);
    const stream = new PartialReadableStream([1, 2, 3]);

    for await (const value of stream as unknown as AsyncIterable<number>) {
      expect(value).toBe(1);
      break;
    }

    expect(stream.cancel).toHaveBeenCalledOnce();
    expect(stream.releaseLock).toHaveBeenCalledOnce();
  });
});
