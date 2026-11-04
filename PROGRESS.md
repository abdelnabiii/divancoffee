# Progress

## Done
- Git baseline of the untouched zip (`99046a6`).
- Phase 0 read-only audit: both modes, 4 widths, all customer + admin flows → `AUDIT.md`, evidence in `audit/phase0/`.
- Found: the Supabase project in `config.js` (`dergispbnahqslvcvwuz`) does not exist (NXDOMAIN). Decision: create a new project.
- Phase 1 (local): `supabase/schema.sql` written — 9 tables, 26 RPCs ported from `engine.js`, RLS on all tables,
  SECURITY DEFINER + `search_path=''`, admin check inside every `admin_*`, bcrypt passwords, hashed 60-day sessions,
  login throttling (5 fails / 15 min per phone, 20 per IP), server-side pricing, order size limits, rate limits
  (5 orders / 10 min and 30 / day per phone, 40 / 10 min per IP), `menu` storage bucket (admins write; webp/png/jpeg; 2 MB), seed from `js/seed.js`.
- `tests/rpc.test.js`: 131 checks, all passing on a local Supabase stand-in (Postgres 16 + PostgREST 12, `tests/local/`).
  Schema loaded twice to prove it is idempotent. Storage policies verified at SQL level.
- `js/api.js`: understands the `{_err}` reply that `login` uses (so failed attempts are recorded).
- Browser check: customer site on the local backend loads 58 items, places a pickup order, shows Arabic login errors, 0 console errors (`audit/phase1-local-order.jpg`).

- `tools/preview.js`: zero-dependency local preview server (demo mode by default, `--live` for the configured Supabase).

- Phase 2 front-end fixes F3–F15 + new F19–F21 (see `AUDIT.md` → Fix status). `?v=5`. Browser regression `tests/site.e2e.js`: 52/52 on Apache 2.4 with the real `.htaccess` + CSP; RPC suite still 131/131.
- Share image `assets/share-1200x630.jpg` (from `tools/share-image.html`), maskable icons, `sitemap.xml`, JSON-LD, `tools/set-domain.js`.

## Blocked
- This environment can't reach `*.supabase.co` and has no Supabase MCP → you run the SQL and the test script; I hand you exact steps.

## Waiting on you
- Create the new Supabase project and send the project URL + anon (or publishable) key.
- The site's public address (for canonical / share tags / sitemap) — asked.
- Next questions (one at a time): keep the demo coupon `DIVAN10`? · admin email.
