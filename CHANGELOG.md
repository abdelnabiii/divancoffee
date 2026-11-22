# Changelog

## v6 — redesign: one travelling 3D coffee bag (2026-11)

Cache version `?v=5` → `?v=6`. Spec: `prompts/divan-redesign-prompt.md` (see "As built" at the top).

### Menu
- **Drinks removed** (hot drinks, iced coffee, cocktails, juices — 46 items). The menu is now coffee beans (4 blends, 3 French coffees) and bakery (6), 13 items. Product IDs of the remaining items are unchanged (`p046`–`p058`); categories ordered blends → French coffee → bakery.

### New page (Stride-style), on top of the unchanged ordering logic
- **Hero:** the 7 bean products as real-time 3D stand-up pouches on an arc (Three.js 0.160.0, self-hosted). Drag/flick, tap a bag, ← / → keys (RTL), next button, autoplay every 3.2 s; feathered colour circle in the bag's colour; name animated word by word (Arabic stays joined); live price + "اطلبه دلوقتي" opening the real product sheet.
- **"من الحبة للفنجان":** pinned section; the selected bag flies in, turns 180° per step (the back shows the bag's real options: price, weight, spice, roast, grind, flavour), then spins through a storm of ingredients.
- **Signature cards:** the bag lands exactly on its own card (follows the card tilt, squashes on tap); the full menu continues below.
- **"اعمل كيسك":** pick blend, weight, spice, roast, grind; live price from the same rule as the server; adds to the same cart.
- Header with section pill (bottom bar on phones), fly-to-cart animation, smooth wheel scrolling, logo-stamp intro (once per 24 h, never on table visits).
- Falls back to flat bag images without WebGL, and to the v5 layout if the module or the catalogue fails. Reduced motion respected throughout.

### Fixed while building
- The page-wide "open product" click handler also fired for any element with `data-pid` (now menu rows only).
- Hero height now subtracts the demo / table banner, so the CTA is never pushed off short screens.

### Tests
- `tests/stage.e2e.js`: 71 checks (arc, RTL order, drag/tap/keys/autoplay, colour, title, CTA → sheet → cart, flips 0/180/360/720°, storm, bag lands on its card within 4 px, builder price = server total, intro rules, reduced motion, 6 screen sizes without overflow or overlap, no-WebGL fallback, no new hosts). v5 suites still pass: `site.e2e.js` 52, `rpc.test.js` 131.

## v5 — production fix-up (2026-11)

Cache version `?v=4` → `?v=5`. Details and evidence: `AUDIT.md`.

### Backend (new)
- `supabase/schema.sql`: the backend that was referenced but never delivered. 9 tables, 26 RPCs ported 1:1 from the demo `handlers` in `js/engine.js` (same shapes, same Arabic messages), `menu` storage bucket, seed from `js/seed.js`. Idempotent, one paste.
- Security: RLS on every table with no direct access for the public key; all access through `SECURITY DEFINER` functions with a fixed `search_path`; admin check inside every `admin_*`; bcrypt customer passwords; random 256-bit session tokens stored hashed, 60-day expiry; login throttling; prices/discounts/totals/points/delivery zone computed server-side only; order size limits; rate limits per phone and per network.
- `supabase/add-admin.sql`, `supabase/optional-demo-coupon.sql`, `supabase/photos.sql` (when photos are added).

### Fixed
- Live site: menu stuck on loading boxes and admin login failing — the configured Supabase project no longer exists. (Needs the new project in `js/config.js`.)
- The live site silently switched to **demo mode** (orders saved only in the customer's browser, demo admin password accepted) if the Supabase library failed to load.
- Misleading "your internet is down" errors; untranslated server errors. Now clear Arabic messages by cause.
- Menu load failure: 15 s of skeletons, then an error that needed a full reload. Now retries with feedback and, after ~5 s, a clear message, a retry button, phone and WhatsApp.
- Header account/cart buttons empty, an empty dark bar in the hero, and "كلمنا واتساب" pointing at `wa.me/undefined` until the menu loaded.
- Scanning a table QR locked the customer into table-only mode for 3 h. Now a "مش على ترابيزة؟" button and 90 min expiry.
- An invalid coupon could not be removed and blocked checkout.
- Map picker: the pin was ~60 m away from the point actually saved; the cafe label was hidden under the pin; deprecated OpenStreetMap tile host.
- 3 px sideways scroll on 360 px phones.
- Giant illustration on every empty screen.
- Toasts covering the title of the cart/product sheet.
- Demo admin password shown on the login page.
- Names not escaped in admin delete-confirmation dialogs.

### Added
- Share / SEO: Open Graph + Twitter card tags, 1200×630 share image, `CafeOrCoffeeShop` JSON-LD (address, map location, social links), canonical link, `sitemap.xml`, sitemap line in `robots.txt` (absolute URLs filled by `tools/set-domain.js`).
- Separate "any" and "maskable" app icons.
- `.htaccess`: Content-Security-Policy, HSTS, Permissions-Policy, proxy-safe HTTPS redirect, 403 for dev files uploaded by mistake.
- `js/config.js`: `phone` / `whatsapp` fallbacks.
- Tools: local preview server, release build with checks, photo pipeline, domain setter, share-image renderer.
- Tests: `tests/rpc.test.js` (131 backend checks), `tests/site.e2e.js` (52 browser checks), local Supabase stand-in.

### Not changed
- Design, Arabic copy, RTL layout, prices and menu content.
- A cancelled order does not give its coupon use back (same as the original rules) — open decision.
