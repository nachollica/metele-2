// Minimal static file server for the exported app (out/), used only by the
// Playwright integration lane. We can't use `next dev` there: Next 16 allows a
// single dev server per project, and the mocked e2e lane already holds one.
// Serving the static export sidesteps that and is closer to production anyway.
//
// Usage: node e2e-integration/serve.mjs [port]
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

const PORT = Number(process.argv[2] ?? 3100)
const ROOT = path.resolve(process.cwd(), "out")

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
}

async function resolveFile(urlPath) {
  // Candidate files for a request path, in order — mirrors how a static host
  // serves a Next export: exact file, then `.html`, then `dir/index.html`.
  const clean = decodeURIComponent((urlPath ?? "/").split("?")[0]).replace(/^\/+/, "")
  const candidates =
    clean === "" ? ["index.html"] : [clean, `${clean}.html`, `${clean}/index.html`]
  for (const rel of candidates) {
    const abs = path.resolve(ROOT, rel)
    // Stay within ROOT (no path traversal).
    if (abs !== ROOT && !abs.startsWith(`${ROOT}${path.sep}`)) continue
    try {
      if ((await stat(abs)).isFile()) return abs
    } catch {
      // try next candidate
    }
  }
  return null
}

const server = createServer(async (req, res) => {
  // SPA fallback: unknown routes serve the root index.html so the client
  // router can take over.
  const file = (await resolveFile(req.url)) ?? path.resolve(ROOT, "index.html")
  try {
    const body = await readFile(file)
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
    })
    res.end(body)
  } catch {
    res.writeHead(404).end("Not found")
  }
})

server.listen(PORT, () => {
  console.log(`[e2e serve] serving ${ROOT} on http://localhost:${PORT}`)
})
