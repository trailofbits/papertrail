import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { installReadableStreamAsyncIterator } from "./lib/readableStreamCompat.ts";
import "./styles.css";
import "pdfjs-dist/web/pdf_viewer.css";

installReadableStreamAsyncIterator();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Papertrail could not find its application root.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
