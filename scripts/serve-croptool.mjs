// Serveert tools/figuur-cropper.html op http://localhost:8088 — localhost is een
// "secure context", nodig voor de File System Access API (rechtstreeks map lezen +
// crops wegschrijven). Zero-dependency. Draai: node scripts/serve-croptool.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "tools");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};
const PORT = 8088;

createServer(async (req, res) => {
  let p = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (p === "/") p = "/figuur-cropper.html";
  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { "Content-Type": TYPES[extname(p)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Niet gevonden");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Croptool draait → http://localhost:${PORT}/figuur-cropper.html`);
  console.log("  (open in Chrome of Edge voor de map-koppeling; Ctrl+C om te stoppen)\n");
});
