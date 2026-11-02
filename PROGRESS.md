# Progress

## Done
- Git baseline of the untouched zip (`99046a6`).
- Phase 0 read-only audit: both modes, 4 widths, all customer + admin flows → `AUDIT.md`, evidence in `audit/phase0/`.
- Found: the Supabase project in `config.js` (`dergispbnahqslvcvwuz`) does not resolve in public DNS (NXDOMAIN) — it doesn't exist.

## Blocked
- Phase 1 backend: needs a reachable Supabase project. This environment also can't reach `*.supabase.co` (egress policy) and has no Supabase MCP, so SQL will be handed over to paste; I'll test it first on a local Postgres 16 that mimics Supabase (roles `anon`/`authenticated`, `auth.uid()`, storage schema).

## Waiting on you
- Which Supabase project to use (see question in chat).
