// Regenerates the seed block inside supabase/schema.sql from js/seed.js.
// Usage: node tools/gen-seed.js
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const SEED = require(path.join(root, "js/seed.js"));
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const j = o => q(JSON.stringify(o)) + "::jsonb";
const L = [];
L.push("insert into public.categories (id, name, icon, sort, active) values");
L.push(SEED.categories.map(c => `  (${q(c.id)}, ${q(c.name)}, ${q(c.icon)}, ${c.sort}, true)`).join(",\n") + "\non conflict (id) do nothing;");
L.push("insert into public.products (id, category, name, price, description, options, popular, active, available, image, sort) values");
L.push(SEED.products.map(p => `  (${q(p.id)}, ${q(p.category)}, ${q(p.name)}, ${p.price}, ${q(p.description || "")}, ${j(p.options || [])}, ${!!p.popular}, ${p.active !== false}, ${p.available !== false}, ${q(p.image || "")}, ${p.sort})`).join(",\n") + "\non conflict (id) do nothing;");
L.push(`insert into public.settings (id, data) values (1, ${j(SEED.settings)})\non conflict (id) do nothing;`);
if (SEED.coupons) for (const c of SEED.coupons)
  L.push(`insert into public.coupons (code, type, value, min_order, max_uses, active) values (${q(c.code)}, ${q(c.type)}, ${c.value}, ${c.min_order || 0}, ${c.max_uses || 0}, true)\non conflict (code) do nothing;`);
// Photos set later (Phase 3) only fill an empty image, so re-running never clobbers a dashboard upload.
const imgs = SEED.products.filter(p => p.image);
if (imgs.length) L.push(imgs.map(p => `update public.products set image = ${q(p.image)} where id = ${q(p.id)} and image = '';`).join("\n"));
const file = path.join(root, "supabase/schema.sql");
const src = fs.readFileSync(file, "utf8");
const out = src.replace(/-- BEGIN SEED\n[\s\S]*?-- END SEED/, "-- BEGIN SEED\n" + L.join("\n") + "\n-- END SEED");
fs.writeFileSync(file, out);
console.log(`seed: ${SEED.categories.length} categories, ${SEED.products.length} products, ${imgs.length} images, ${(SEED.coupons || []).length} coupons`);
