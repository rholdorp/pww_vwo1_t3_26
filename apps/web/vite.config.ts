import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { schrijfFeedbackPlugin } from "./server/schrijfFeedback";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

export default defineConfig(({ mode }) => {
  // Laad alle env-vars (geen prefix-filter) zodat ANTHROPIC_API_KEY server-side
  // beschikbaar is voor de feedback-proxy. Wordt NIET aan de client blootgesteld
  // (geen VITE_-prefix → komt niet in import.meta.env / de bundle).
  const env = loadEnv(mode, here, "");
  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

  return {
    base: "./",
    plugins: [react(), schrijfFeedbackPlugin(apiKey)],
    server: {
      fs: { allow: [repoRoot] },
    },
  };
});
