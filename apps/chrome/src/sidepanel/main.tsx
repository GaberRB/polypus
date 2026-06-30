/** Side panel entry — renders the chat app into the panel root. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { setLocale, detectLocale } from "../shared/i18n.js";

setLocale(detectLocale());

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}