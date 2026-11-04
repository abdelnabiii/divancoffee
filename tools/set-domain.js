// Fills the site's public address into canonical/og/twitter/JSON-LD, sitemap.xml and robots.txt.
// Usage: node tools/set-domain.js https://www.example.com      (run again with a new address to change it)
const fs = require("fs"), path = require("path");
const url = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(url)) { console.error("Give the full https address, e.g. https://www.divancoffee.com"); process.exit(1); }
const root = path.join(__dirname, ".."), files = ["index.html", "sitemap.xml", "robots.txt"];
const state = path.join(__dirname, ".site-url");
const prev = fs.existsSync(state) ? fs.readFileSync(state, "utf8").trim() : null;
for (const f of files) {
  const p = path.join(root, f); let s = fs.readFileSync(p, "utf8");
  s = s.split("%SITE_URL%").join(url); if (prev && prev !== url) s = s.split(prev + "/").join(url + "/");
  fs.writeFileSync(p, s);
}
fs.writeFileSync(state, url + "\n");
console.log("Site address set to " + url + " in " + files.join(", "));
