import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Monorepo-root: content/ en de workspace-packages liggen erboven.
const repoRoot = resolve(here, "..", "..");

export default defineConfig({
  // Relatieve asset-paden zodat een GitHub-Pages-subpad ook werkt.
  base: "./",
  plugins: [react()],
  server: {
    // De content-JSON + raw-afbeeldingen worden via import.meta.glob uit de repo-root
    // gebundeld; sta toe dat de dev-server daar leest.
    fs: { allow: [repoRoot] },
  },
});
