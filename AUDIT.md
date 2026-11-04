# Phase 0 audit — Divan Coffee ordering site

Date: 2026-11-02. Baseline commit `99046a6` (untouched zip).
Method: local static server + Playwright (Chromium), demo mode (config URL blanked via request interception, no file edits) and live mode (real `config.js`), at 360 / 390 / 768 / 1280 px.
Evidence: screenshots and raw log in `audit/phase0/` (`audit-log.txt` is the test output).

## What was exercised

| Flow | Demo mode | Live mode |
|---|---|---|
| Menu render, 58 products, category rail | ✅ | ❌ never loads (F1) |
| Product options: required group enforced, multi/single, kg factor (¼ kg Special + spiced + dark = 300 ج, correct per `lineUnit`) | ✅ | ❌ |
| Cart, qty stepper, edit line, sticky cart bar | ✅ | ❌ |
| Coupon `DIVAN10` (10 %, min 100) → −38 ج on 380 ج | ✅ | ❌ |
| Delivery: GPS button, Leaflet picker, OSM tiles load, radius check | ✅ | ❌ |
| Pickup order, table order (`?t=7` banner + table-only mode) | ✅ | ❌ |
| Checkout → tracking sheet → WhatsApp hand-off link | ✅ | ❌ |
| Register / login / points earned on `done` / change password | ✅ | ❌ |
| Admin: login, orders, status flow, points award, menu editor save, coupons, customers, reports, settings, table QR codes | ✅ | ❌ login fails (F1) |
| Console errors | none | `net::ERR_NAME_NOT_RESOLVED` on every RPC |
| Horizontal overflow | 360 px: +3 px (F9); 390/768/1280: none | — |
| XSS probe: customer named `<img src=x onerror=alert(1)>` | rendered as text in site + admin (0 injected nodes) | — |

## Findings

Severity: **Critical** = site can't take orders / data at risk · **High** = wrong or unsafe behaviour customers will hit · **Medium** = visible bug or hardening gap · **Low** = polish.

| # | Symptom | Cause | Severity | Fix |
|---|---|---|---|---|
| F1 | Live: menu shows skeleton boxes for ~15 s, then "النت فاصل أو السيرفر مش بيرد" (*your internet is down*). Admin login says the same. Nothing ever works. | **The Supabase project `dergispbnahqslvcvwuz` does not exist.** Public DNS (Google + Cloudflare) returns NXDOMAIN for `dergispbnahqslvcvwuz.supabase.co`, so the project was deleted or never created. Every RPC fails before reaching a server. | Critical | Phase 1: a new (or correct) Supabase project + `supabase/schema.sql`, then update `config.js`. |
| F2 | Even with a reachable project, nothing would work. | The backend was never delivered. `supabase/schema.sql` (referenced in `engine.js`) is missing: no tables, none of the 26 RPCs, no RLS, no `menu` storage bucket, no admin table. | Critical | Phase 1: write the idempotent schema, port `handlers` exactly, plus security (RLS, SECURITY DEFINER, bcrypt, hashed expiring sessions, throttling, server-side pricing, rate limits). |
| F3 | If `vendor/supabase.min.js` fails to load (blocked, 404, bad upload), the production site **silently switches to demo mode**: orders are saved only in the customer's browser and never reach the cafe, and the admin accepts the demo password `divan2026`. | `api.js`: `live = !!(url && key && window.supabase)`. A missing library is treated like "no config". | Critical | Live mode whenever a URL is configured; if the library is missing, show an error instead of falling back. Demo mode only when `supabaseUrl` is empty. |
| F4 | Error text misleads and is sometimes English. A missing backend reads as "your internet is down". A missing RPC (PostgREST `PGRST202`) would show the raw English "Could not find the function…". | `friendly()` maps only fetch errors and JWT; everything else passes through. | High | Separate messages for offline vs. server not responding vs. server error, all in Arabic. Log the technical detail to the console. |
| F5 | Catalog failure UX: 15 s of skeletons with no feedback, then an error. | `boot()` retries 4× silently (1.5+3+4.5+6 s) before showing anything. | High | Show a "بنحاول تاني…" (retrying) state after the first failure; final state is a clear Arabic error with a retry button that retries in place (no full reload). |
| F6 | While the catalog hasn't loaded (and forever if it fails), the header **account and cart buttons are empty boxes**, the mode bar is an empty dark strip, and "كلمنا واتساب" points to `https://wa.me/undefined`. The phone line is missing, so a customer has no way to contact the cafe exactly when the site is broken. | `renderHeader()` runs only after `get_catalog`. `renderVisit()` runs before it and reads `whatsapp`/`phone` from settings that aren't loaded yet. | High | Render icons immediately and hide the empty mode bar. Add `whatsapp`/`phone` fallbacks to `config.js` used until settings arrive. |
| F7 | A customer who scanned a table QR is stuck in **table-only mode for 3 hours**, even at home, with no delivery/pickup option and no way out. | `readTable()` persists the table in `localStorage` for 3 h, and `availableModes()` returns only `table` when `tableNo` is set. | Medium | Add a "مش على ترابيزة؟" (not at a table?) action in the banner that clears it. Shorten persistence to ~90 min. |
| F8 | Demo admin password is visible in `admin.html` ("باسورد الدخول: divan2026") and hard-coded in `api.js`. | Demo convenience shipped to prod. | Medium | Remove from the HTML. Demo admin login only when `supabaseUrl` is empty (after the F3 fix). |
| F9 | 360 px: page scrolls sideways by 3 px. | The bakery row "كرواسون تركي بالجبنة" + "★ الأشهر" badge are `nowrap`. The `.items` grid track uses `auto` min-width, so the longest row's min-content widens the column. | Medium | `.items { grid-template-columns: minmax(0,1fr) }` (and the 2-col variant). |
| F10 | Share/SEO: link previews show nothing. `og:image` is a relative path to the square app icon. No `og:url`, Twitter card, canonical, sitemap or structured data. | Not implemented. | Medium | Absolute OG/Twitter tags, a 1200×630 share image, canonical, `sitemap.xml`, sitemap line in `robots.txt`, `CafeOrCoffeeShop` JSON-LD. |
| F11 | `.htaccess`: no CSP, HSTS or Permissions-Policy. The HTTPS redirect uses only `%{HTTPS}`, which can loop behind a proxy/CDN (e.g. Cloudflare flexible SSL). | Minimal config. | Medium | Add headers (CSP allowing self, Supabase, OSM tiles, `wa.me`), add an `X-Forwarded-Proto` guard on the redirect, keep `admin.html` noindex + DENY framing. |
| F12 | Manifest: one 512 px icon marked `"any maskable"`. Maskable crops ~20 %, so the logo gets cut on Android. | Single icon reused for both purposes. | Low | Separate `any` and `maskable` icons (maskable with safe-zone padding). |
| F13 | Admin `confirmBox()` puts product/category names and coupon codes into `innerHTML` unescaped. | Missing `esc()` there; every other `innerHTML` path escapes user data. | Low (admin-authored data only) | Wrap with `esc()`. Server-side output is also typed (ints/numerics) so numeric interpolations stay safe. |
| F14 | Map picker opens centred on the cafe, so the centre pin hides the "ديفان" cafe label. Tiles use the deprecated `{s}.tile.openstreetmap.org` subdomains. | Cosmetic / OSM policy. | Low | Offset the label above the pin. Use `tile.openstreetmap.org`. |
| F15 | Toasts (top: 76 px) cover the title of a tall bottom sheet on phones (see `flow-cart-delivery.jpg`). | Fixed toast position. | Low | Move the toast above the sheet footer while a sheet is open. |
| F16 | Coupon `used` count increments when an order is placed and is never returned if the order is cancelled. | `place_order` / `admin_set_status` in the spec. | Low (business rule) | Keep spec behaviour by default. Flagged for your decision; it can return the use on cancel. |
| F17 | All 58 products have `image: ""`, so every item uses the line-art fallback. | No photos provided. | Content | Phase 3 (`MISSING.md`, one photo at a time). |
| F18 | Unverified business values: `hours` empty, WhatsApp/phone, coordinates, 50 km radius, fee 30, min 0, 15 tables, cashback 10 % cap 100, prices. | Seed data. | Content | Phase 3 confirmations. |

Not bugs (checked and OK): pricing math (`lineUnit`, kg factors, option prices), coupon min-order and %, points earn/award/refund in demo, required-option validation, RTL layout, local fonts loading, Leaflet loading lazily from `vendor/`, the sticky cart bar, bottom sheets with the back button, the QR codes (they encode `<site>/?t=N`; the app reads `?t=`, not `?table=`, and both match), print layout trigger, admin views at 360/768 px (no overflow), and `esc()` on every customer-entered field (name, phone, address, notes, item notes).

## Fix status (Phase 2, cache version `?v=5`)

Verified by `tests/site.e2e.js` (52 browser checks, run on Apache 2.4 with the real `.htaccess`, CSP active) and `tests/rpc.test.js` (131 backend checks). Evidence: `audit/phase2/`.

| # | Status | What changed |
|---|---|---|
| F1 | ⏳ waiting on you | New Supabase project, then `config.js`. |
| F2 | ✅ (local) | `supabase/schema.sql` (Phase 1). Goes live when you run it. |
| F3 | ✅ | `api.js`: demo mode only when `supabaseUrl` is empty. Missing library → clear error; the demo admin password is refused with a production config. |
| F4 | ✅ | Separate Arabic messages for offline / server not answering / setup / server error; technical detail goes to the console. |
| F5 | ✅ | 3 tries with "بنحاول نوصل للسيرفر…", then a clear error after ~5 s (was ~15 s), with a retry button that reloads the menu in place and phone/WhatsApp links. Auto-retries when the device comes back online. |
| F6 | ✅ | Header icons render immediately. The mode bar and loyalty card stay hidden until settings load. Phone/WhatsApp fall back to `config.js`. |
| F7 | ✅ | "مش على ترابيزة؟" button in the table banner. Table mode now expires after 90 min (was 3 h). |
| F8 | ✅ | Password hint removed from `admin.html` and the error message. |
| F9 | ✅ | `.items` uses `minmax(0,1fr)`. No overflow at 360/390/768/1280. |
| F10 | 🟡 needs the domain | Twitter card, OG type/locale/size, 1200×630 `assets/share-1200x630.jpg`, `CafeOrCoffeeShop` JSON-LD, `sitemap.xml`, sitemap line in `robots.txt`. Absolute URLs use `%SITE_URL%` until `node tools/set-domain.js https://…` fills them in. |
| F11 | ✅ | CSP, HSTS (HTTPS only), Permissions-Policy, COOP. HTTPS redirect guarded by `X-Forwarded-Proto`. Dev folders/notes return 403 if uploaded by mistake. Tested on real Apache. |
| F12 | ✅ | Separate `any` and `maskable` icons (`assets/icon-maskable-*.png`, logo inside the safe zone). |
| F13 | ✅ | `esc()` in admin confirm dialogs; order-card fields escaped / coerced to numbers. XSS probe: a product named `<img src=x onerror=…>` stays text. |
| F14 | ✅ | Tiles from `tile.openstreetmap.org`. Cafe label sits under the point. |
| F15 | ✅ | While a sheet is open the toast moves to the very top, off the sheet title. |
| F16 | — | Unchanged (spec behaviour). Decide later. |
| F17–F18 | ⏳ Phase 3 | Photos and value confirmations. |

New bugs found while fixing, also fixed:

| # | Symptom | Cause | Severity | Fix |
|---|---|---|---|---|
| F19 | An invalid coupon (e.g. under its minimum) can't be removed: clearing the field says "اكتب الكود" and checkout stays blocked with "كود الخصم مش شغال". | The apply handler returned early on an empty field without clearing the stored coupon. | High | Empty field + "تطبيق" now removes the coupon ("اتشال الكود"). |
| F20 | Map picker pin tip sits ~27 px below the point that gets saved (≈60 m at street zoom). | Pin centred on the whole picker screen, not on the map area under the header. | Medium | Pin positioned on the map's centre and kept there with a `ResizeObserver`. |
| F21 | Every empty state (empty cart, no orders, menu error) shows a giant full-width cup. | Illustration inserted without the `.ill` wrapper the CSS sizes. | Low | CSS sizes `.empty > svg` too. |
