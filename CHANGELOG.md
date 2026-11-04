# Changelog

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
