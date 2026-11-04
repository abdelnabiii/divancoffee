# Divan Coffee — online ordering site

Arabic (RTL, Egyptian dialect) ordering site for **ديفان كوفي**, X Mall, Fifth Settlement, Cairo.
Plain HTML/CSS/JS with **no build step**, hosted on cPanel. Backend: **Supabase** (Postgres + Auth + Storage).

| Page | Files |
|---|---|
| Customer site | `index.html`, `js/app.js`, `css/app.css` |
| Admin dashboard | `admin.html`, `js/admin.js`, `css/admin.css` |
| Shared | `js/config.js` (settings), `js/api.js` (backend calls), `js/engine.js` (price rules + demo backend), `js/seed.js` (starting menu), `js/art.js` (icons) |
| Backend | `supabase/schema.sql` (everything, one paste) |

Other folders are for development only and are **never uploaded**: `tools/`, `tests/`, `supabase/`, `audit/`, and the `*.md` notes.

---

## 1. Configuration — `js/config.js`

The only file you normally edit when installing.

```js
supabaseUrl: "https://xxxx.supabase.co",   // Supabase → Project Settings → API Keys / Data API
supabaseAnonKey: "sb_publishable_…",        // the publishable key, or the legacy "anon" key
phone: "01000160277",                       // shown until settings load / if the server is down
whatsapp: "201000160277",                   // with country code, no +
address, mapUrl, social { facebook, instagram, tiktok }, handle, credit
```

- **Never** put the `service_role` / secret key here or anywhere in the site. The publishable/anon key is meant to be public: the database only lets it call the functions listed in section 2.
- **Demo mode**: if `supabaseUrl` is empty, the site runs without a server (menu from `seed.js`, orders saved only in that browser, admin password `divan2026`). Use it only for previews. With a URL set, the site never falls back to demo mode; if the server can't be reached it shows an error with your phone and WhatsApp.
- Delivery fee, minimum order, tables, cashback, hours, WhatsApp and phone are changed in the **dashboard → الإعدادات**, not in this file.

## 2. Backend — running `supabase/schema.sql`

1. Create a Supabase project (free plan is fine; region **Central EU (Frankfurt)** is closest to Cairo).
2. Supabase → **SQL Editor** → New query → paste the whole of `supabase/schema.sql` → **Run**.
   It is idempotent: running it again keeps your data and only refreshes functions, grants and policies.
3. Optional: run `supabase/optional-demo-coupon.sql` if you want the `DIVAN10` coupon.
4. Supabase → **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up" (admins are created by hand; customers use the site's own phone accounts, not Supabase Auth).
5. Supabase → **Authentication → URL Configuration**: set **Site URL** to your domain.

What it creates:
- **Tables** (all with Row Level Security on and no policies, so the publishable key can't read or write them directly): `categories`, `products`, `settings`, `coupons`, `customers`, `customer_sessions`, `orders`, `admins`, `auth_events`.
- **26 functions** the site calls. 11 for customers (`get_catalog`, `validate_coupon`, `place_order`, `track_order`, `register`, `login`, `me`, `logout`, `change_password`, `my_orders`, `is_admin`) and 15 `admin_*` functions that check the caller is in `admins`.
- **Rules enforced on the server**: prices, discounts, totals, points and the delivery zone are calculated in the database (whatever the browser sends is ignored); customer passwords are bcrypt-hashed; login tokens are random, stored hashed, valid 60 days; 5 wrong passwords lock a phone for 15 min; max 5 orders per phone per 10 min (30/day) and 40 per network per 10 min; max 40 lines / 50 per item per order.
- **Storage bucket `menu`**: public to view, only admins can upload; webp/png/jpeg, 2 MB max.
- **The starting menu** from `js/seed.js` (7 categories, 58 products, settings). Re-running never overwrites what you changed in the dashboard.

### Check it with the test script

Needs Node.js 18+. It uses only the publishable key, plus the admin login for the admin checks (read from the environment, never printed).

macOS / Linux:
```bash
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=sb_publishable_xxx ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' node tests/rpc.test.js
```
Windows PowerShell:
```bash
$env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_ANON_KEY="sb_publishable_xxx"; $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="…"; node tests/rpc.test.js
```
Expect `… passed, 0 failed`. It leaves a few cancelled test orders and test customers (names start with "اختبار", phones 0155…); `tests/cleanup.sql` removes them.

## 3. Creating the admin user

1. Supabase → **Authentication → Users → Add user → Create new user**: the admin's email and a strong password, tick **Auto Confirm User**.
2. SQL Editor: open `supabase/add-admin.sql`, replace `ADMIN_EMAIL_HERE` with that email, Run.
3. Log in at `https://your-domain/admin.html`.

More admins: repeat both steps. Remove one: the `delete` line at the bottom of `add-admin.sql`. Change a password: Supabase → Authentication → Users → the user → Send password recovery / reset.

## 4. Adding products and photos

**From the dashboard (normal way):** `admin.html` → **المنيو** → `+ صنف`, or tap a product to edit it. You can set name, price, category, description, option groups (e.g. sugar, size; "+ سعر" adds to the price, "× مضاعف" multiplies, e.g. ¼ kg = 0.25), "متاح النهارده" (sold out today), "ظاهر في المنيو" (hidden) and "من الأكثر طلبًا" (popular). **رفع صورة** shrinks the photo to WebP ≤900 px in the browser and uploads it to the `menu` bucket.

**Photos shipped with the site (developer way):**
```bash
python3 -I tools/add-photo.py p002 ~/Downloads/turkish-double.jpg
```
This converts to WebP (≤900 px, quality 85) → `assets/menu/p002.webp`, records it in `js/seed.js` and in the seed part of `supabase/schema.sql`, and appends an `update` to `supabase/photos.sql`. For a database that is already live, run `supabase/photos.sql` in the SQL Editor, then upload the new `assets/menu/` files. `MISSING.md` lists which photos are still missing. Product IDs are in `js/seed.js` (`p001`…`p058`, in menu order).

## 5. Updating the site

1. Make the change.
2. **Bump the cache number** in `index.html` and `admin.html` (all `?v=5` → `?v=6`) and the two `?v=` in `js/app.js` (Leaflet). Visitors' browsers keep CSS/JS for a week, and the new number makes them fetch the new files.
3. Preview locally: `node tools/preview.js` → http://localhost:8080 (demo mode), or `node tools/preview.js --live` (uses the Supabase project in `config.js`).
4. Run the checks (developer machine with Playwright): `node tests/site.e2e.js http://localhost:8088/ audit/latest` against an Apache copy, and `tests/rpc.test.js` if the database changed.
5. Build the upload: `python3 -I tools/build-zip.py` → `../divan-upload-to-cpanel.zip` (next to the site folder). The build stops if a referenced file is missing, `?v=` numbers differ, JS doesn't parse, or a secret key / demo password is found.
6. Upload as described in `DEPLOY.md`.

Changing the database: edit `supabase/schema.sql` and paste it again (safe to re-run). Keep function names and parameters the same, or drop the old function first.

## 6. Site address (SEO / link previews)

Once the domain is known:
```bash
node tools/set-domain.js https://www.your-domain.com
```
This fills the canonical link, `og:url`, `og:image`, Twitter image, JSON-LD and `sitemap.xml`/`robots.txt`. Until then the build leaves those tags out instead of shipping a broken address. The share image is `assets/share-1200x630.jpg` (template: `tools/share-image.html`, render with `node tools/make-share-image.js`).

## 7. Development tools

| Tool | What |
|---|---|
| `tools/preview.js` | Local server, demo mode by default. Needs only Node.js |
| `tools/build-zip.py` | Release checks + upload zip |
| `tools/add-photo.py` / `tools/photo-shot.js` | Product photos / before-after screenshots |
| `tools/set-domain.js` | Site address into SEO tags |
| `tools/gen-seed.js` | Regenerates the seed block of `schema.sql` from `js/seed.js` |
| `tests/rpc.test.js` | 131 backend checks, incl. security (anon can't read tables or call admin functions, tampered prices ignored, delivery radius, coupons, points) |
| `tests/site.e2e.js` | 52 browser checks (layout at 360–1280 px, flows, CSP, error states) |
| `tests/local/` | A local Supabase stand-in (Postgres 16 + PostgREST) for running the tests without a real project |

`AUDIT.md` has the original findings and what was fixed; `CHANGELOG.md` the release notes; `DEPLOY.md` the cPanel checklist.
