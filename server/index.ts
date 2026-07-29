import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";

import { answerQuestion, chatRequestSchema } from "./chat.ts";
import { documentRegistrationSchema, registerDocument } from "./documentStore.ts";

try {
  process.loadEnvFile(".env");
} catch (error) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code !== "ENOENT") {
    throw error;
  }
}

const app = express();
const port = Number(process.env["PORT"] ?? 4173);
const directory = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(express.json({ limit: "15mb" }));

app.get("/api/config", (_request, response) => {
  response.json({
    providers: {
      openai: Boolean(process.env["OPENAI_API_KEY"]),
      anthropic: Boolean(process.env["ANTHROPIC_API_KEY"]),
    },
  });
});

app.post("/api/chat", async (request, response, next) => {
  try {
    const body = chatRequestSchema.parse(request.body);
    response.json({ answer: await answerQuestion(body) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/documents", (request, response, next) => {
  try {
    const body = documentRegistrationSchema.parse(request.body);
    response.json({
      documentId: registerDocument(body.pages, body.replacesDocumentId),
    });
  } catch (error) {
    next(error);
  }
});

async function configureFrontend(): Promise<void> {
  if (process.env["NODE_ENV"] === "production") {
    const distribution = path.resolve(directory, "../dist");
    app.use(express.static(distribution));
    app.get("*path", (_request, response) => {
      response.sendFile(path.join(distribution, "index.html"));
    });
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    response.status(400).json({ error: "The request was malformed." });
    return;
  }
  const message = error instanceof Error ? error.message : "The AI request failed.";
  response.status(500).json({ error: message });
}

await configureFrontend();
app.use(errorHandler);
app.listen(port, () => {
  console.log(`Papertrail is ready at http://localhost:${port}`);
});
