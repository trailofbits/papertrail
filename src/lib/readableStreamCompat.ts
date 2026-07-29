type StreamIteratorOptions = {
  preventCancel?: boolean;
};

type StreamPrototype = {
  values?: <T>(
    this: ReadableStream<T>,
    options?: StreamIteratorOptions,
  ) => AsyncIterableIterator<T>;
  [Symbol.asyncIterator]?: <T>(this: ReadableStream<T>) => AsyncIterableIterator<T>;
};

async function* iterateStream<T>(
  stream: ReadableStream<T>,
  options: StreamIteratorOptions = {},
): AsyncGenerator<T, void, undefined> {
  const reader = stream.getReader();
  let completed = false;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        completed = true;
        return;
      }
      yield result.value;
    }
  } finally {
    if (!completed && !options.preventCancel) {
      await reader.cancel();
    }
    reader.releaseLock();
  }
}

function streamValues<T>(
  this: ReadableStream<T>,
  options?: StreamIteratorOptions,
): AsyncIterableIterator<T> {
  return iterateStream(this, options);
}

export function installReadableStreamAsyncIterator(
  constructor: typeof ReadableStream | undefined = globalThis.ReadableStream,
): boolean {
  if (!constructor) {
    return false;
  }
  const prototype = constructor.prototype as StreamPrototype;
  const values = prototype.values ?? streamValues;
  if (!prototype.values) {
    Object.defineProperty(prototype, "values", {
      configurable: true,
      writable: true,
      value: values,
    });
  }
  if (!prototype[Symbol.asyncIterator]) {
    Object.defineProperty(prototype, Symbol.asyncIterator, {
      configurable: true,
      writable: true,
      value: values,
    });
  }
  return true;
}
