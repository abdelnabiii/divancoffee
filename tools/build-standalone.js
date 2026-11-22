/* Builds ONE self-contained preview file: divan-preview.html (double-click to open; no server, no install).
   Demo mode (no Supabase): menu from js/seed.js, orders saved in that browser only.
   Everything is inlined — CSS, fonts, images, Leaflet, Three.js and the v6 modules (bundled with esbuild) —
   because browsers block separate modules and image→canvas reads on file:// pages.
   Dev only. Usage:  node tools/build-standalone.js [out.html]     (needs esbuild: npm i esbuild)
   Default output: ../divan-preview.html (next to the site folder). */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "..", "divan-preview.html"));
let esbuild; try { esbuild = require(process.env.ESBUILD_PATH || "esbuild"); } catch (e) { console.error("needs esbuild: npm i esbuild (or set ESBUILD_PATH)"); process.exit(1); }

const read = p => fs.readFileSync(path.join(ROOT, p));
const MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const dataURI = p => `data:${MIME[path.extname(p)]};base64,${read(p).toString("base64")}`;
// every asset path any file mentions, e.g. assets/logo-red.webp → data: URI
const ASSETS = fs.readdirSync(path.join(ROOT, "assets")).filter(f => MIME[path.extname(f)]).map(f => "assets/" + f);
const inlineAssets = (txt) => ASSETS.reduce((t, a) => t.split("../" + a).join(dataURI(a)).split(a).join(dataURI(a)), txt);
const inlineCssUrls = (css, base) => css.replace(/url\((["']?)([^)"']+)\1\)/g, (m, q, u) => {
  if (/^(data:|https?:|#|%23)/.test(u)) return m;
  const p = path.normalize(path.join(base, u.split("?")[0]));
  return fs.existsSync(path.join(ROOT, p)) && MIME[path.extname(p)] ? `url("${dataURI(p)}")` : m;
});

(async () => {
  let html = read("index.html").toString();
  // CSS (+ fonts and images inside) inline
  html = html.replace(/<link rel="stylesheet" href="([^"?]+)(\?[^"]*)?">/g, (m, href) => `<style>\n${inlineCssUrls(read(href).toString(), path.dirname(href))}\n</style>`);
  // drop preloads/manifest/canonical (meaningless on file://), inline icons and images
  html = html.replace(/<link rel="(preload|manifest|canonical)"[^>]*>\n?/g, "");
  html = html.replace(/<meta (property|name)="(og:[^"]+|twitter:[^"]+)"[^>]*>\n?/g, "");
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, "");
  html = inlineAssets(html);
  // classic scripts: config forced to demo; no supabase library needed in demo mode
  const classic = ["js/config.js", "js/seed.js", "js/engine.js", "js/art.js", "js/api.js", "js/app.js"];
  let code = "";
  for (const f of classic) {
    let t = read(f).toString();
    if (f === "js/config.js") t = t.replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""').replace(/supabaseAnonKey:\s*"[^"]*"/, 'supabaseAnonKey: ""');
    code += `<script>\n${inlineAssets(t).replace(/<\/script/gi, "<\\/script")}\n</script>\n`;
  }
  // Leaflet inline (the map picker loads it only if window.L is missing)
  const leafletCss = inlineCssUrls(read("vendor/leaflet/leaflet.css").toString(), "vendor/leaflet");
  code = `<style>\n${leafletCss}\n</style>\n<script>\n${read("vendor/leaflet/leaflet.js").toString().replace(/<\/script/gi, "<\\/script")}\n</script>\n` + code;
  // v6 modules: bundle stage.js (+ bag.js, three, RoomEnvironment) into one inline script
  const strip = { name: "strip-query-and-inline-assets", setup(b) {
    b.onResolve({ filter: /\?v=/ }, a => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?.*$/, "")) }));
    b.onLoad({ filter: /js[\\/](bag|stage)\.js$/ }, a => {
      let t = fs.readFileSync(a.path, "utf8");
      t = t.replace(/new URL\("\.\.\/(assets\/[^"]+)", import\.meta\.url\)\.href/g, (m, p) => JSON.stringify(dataURI(p)));
      return { contents: inlineAssets(t), loader: "js" };
    });
  } };
  const r = await esbuild.build({ entryPoints: [path.join(ROOT, "js/stage.js")], bundle: true, format: "iife", minify: true, write: false, plugins: [strip], target: "es2020", logLevel: "error" });
  const bundle = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  code += `<script>\n${bundle}\n</script>\n`;
  // replace all original <script src> tags with the inlined code
  html = html.replace(/(<script src="[^"]+"><\/script>\n?|<script type="module" src="[^"]+"><\/script>\n?)+/, () => code);   // function: no $-patterns
  if (/<script[^>]+src=/.test(html)) throw new Error("a <script src> was left in the page");
  if (/(src|href)="(assets|css|js|vendor|fonts)\//.test(html)) console.warn("warning: a local reference was not inlined:", html.match(/(src|href)="(assets|css|js|vendor|fonts)\/[^"]+"/)[0]);
  fs.writeFileSync(OUT, html);
  console.log(`OK ${OUT} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`);
})().catch(e => { console.error("FAILED", e.message); process.exit(1); });
