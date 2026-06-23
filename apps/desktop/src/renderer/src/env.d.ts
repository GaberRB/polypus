/// <reference types="vite/client" />
import type { PolypusApi } from "../../preload";

declare global {
  interface Window {
    /** Bridge exposed by the preload script (see src/preload/index.ts). */
    polypus?: PolypusApi;
  }
}

export {};
