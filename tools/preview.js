#!/usr/bin/env node
/* Local preview server — no installs needed, just Node.js 18+.
     node tools/preview.js            → http://localhost:8080  (demo mode: no Supabase, data stays in your browser)
     node tools/preview.js 3000       → another port
     node tools/preview.js --live     → use the Supabase project in js/config.js
   Demo mode is done by rewriting js/config.js in memory only; the file on disk is untouched.
   Not part of the site: never upload the tools/ folder to cPanel. */
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const PORT = Number(args.find(a => /^\d+$/.test(a))) || 8080;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
const HIDDEN = /^\/(\.git|tests|tools|supabase|audit|node_modules)(\/|$)/;

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep) || HIDDEN.test(p)) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Not found"); }
    if (!LIVE && p === "/js/config.js")
      buf = Buffer.from(buf.toString("utf8").replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""').replace(/supabaseAnonKey:\s*"[^"]*"/, 'supabaseAnonKey: ""'));
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`Divan Coffee preview (${LIVE ? "LIVE — Supabase from js/config.js" : "demo mode — no Supabase"})`);
  console.log(`  Site:  http://localhost:${PORT}/`);
  console.log(`  Table: http://localhost:${PORT}/?t=5`);
  console.log(`  Admin: http://localhost:${PORT}/admin.html${LIVE ? "" : "   (demo password: divan2026)"}`);
  console.log("Ctrl+C to stop.");
});
