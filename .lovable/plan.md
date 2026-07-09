This is a very large scope — a full enterprise CRM. Building all 13 sections in one turn would produce shallow, half-wired UI across the board. I'll ship it in phases, starting with the security-critical foundation this turn and confirming direction before we go deep on each module.

## Phase 1 — Foundation (this turn)

**1. Hide Admin & gate access by role**
- Remove any public entry point to `/admin` (nav links, buttons, `CreatePanel` tiles that expose forge to non-admins).
- Move the admin surface under `src/routes/_authenticated/admin/*` and add a `beforeLoad` role check using existing `has_role(_user_id, 'admin')` (already in the DB). Non-admins get 404.
- Add an `admin` login route at `/admin-console` (obscure path) that reuses the existing auth flow but redirects to `/admin` only when `has_role('admin')` returns true.
- Bootstrap the first admin: I'll add a migration that grants `admin` role to a specific email you provide (or the first signed-up user if you prefer). **I need you to tell me the admin email.** No hardcoded credentials — you sign in normally with magic link/password and the role table decides access.

**2. New admin shell**
- New route tree: `/admin` (overview), `/admin/users`, `/admin/products`, `/admin/orders`, `/admin/campaigns`, `/admin/bounties`, `/admin/reports`, `/admin/features`, `/admin/pricing`, `/admin/audit`, `/admin/team`, `/admin/broadcasts`.
- Sidebar layout with KPI cards on overview (users, revenue, orders, active campaigns) using real Supabase queries.
- Dark by default, matches existing Oventric theme tokens.

**3. Feature flags + audit log tables**
- `feature_flags` (key, enabled, scope=global|role|user, target_id nullable) + `platform_settings` singleton (base currency, live FX toggle).
- `audit_logs` (actor_id, action, target_kind, target_id, meta jsonb, created_at) written from all admin server fns.
- `ad_campaigns` table replacing the in-memory admin store (title, advertiser, description, status, start_at, end_at, placements[], tier, header, body, media_path, cta_type, cta_url) — real DB-backed with RLS.
- `marketplace_categories` (slug, name, sort_order, enabled).

## Phase 2 — Content moderation (next turn, on your go-ahead)

- Products moderation table: admin list of every uploaded product with edit / approve / pause / delete / flag / restore actions (add `moderation_status` + `deleted_at` to `products`).
- Asset management view (files in `product-files` + `product-covers` with search/filter/replace).
- Marketplace banners table + upload UI.
- Category CRUD with drag reorder.

## Phase 3 — Campaigns v2 (next turn)

- Rebuild AdInjector with tier-specific dynamic forms (text / image / video ≤50MB), multi-placement selector, CTA type dropdown (website/registration/landing/whatsapp/facebook/instagram/linkedin/x/youtube/telegram/custom). Video upload to a new `ad-media` bucket.
- Placement components in Feed/Marketplace/Academy read from `ad_campaigns` scheduled window.

## Phase 4 — Global pricing matrix

- `pricing_rules` table (product_id nullable = global default markup, base_currency USD, price).
- Server-side FX cache table refreshed from an FX API (exchangerate.host — free, no key). Admin toggle to use live vs fixed rates.
- All price rendering routes through one `formatMoney(usd, userCurrency)` helper reading FX cache.

## Phase 5 — Users, team, permissions, communications, analytics

- Full user management (suspend/ban/verify/role via Auth Admin API), team invites, per-feature per-user flags.
- Broadcast center (in-app notifications table + email via Lovable Emails once a domain is set — I'll ask before wiring email).
- Analytics dashboards with real chart data (recharts).
- Audit log viewer with filters.

## Sovereign Mega Bounty fix (Phase 2)

Currency selector locked to the user's wallet/country currency; escrow amount stored in USD after FX conversion, displayed in wallet currency. One-currency-only enforcement in the form.

## What I need from you before Phase 1 ships

1. **Admin email address** (the account that gets the first `admin` role). If you want more than one admin seeded, list them.
2. Confirmation that "hide admin from frontend" means: no visible link anywhere for non-admins, and the `/admin` URL 404s for them. (Vs. a "Coming soon" page.)
3. OK to defer Phases 2–5 to follow-up turns so each ships fully working rather than half-scaffolded.

## Technical notes

- All new tables get GRANTs + RLS in the same migration; admin-only policies use `has_role(auth.uid(), 'admin')`.
- Audit logging via a shared server-fn wrapper so every admin mutation writes a row.
- No new secrets required for Phase 1. FX API is public. Video upload uses existing storage.
- Existing `src/lib/admin/store.ts` in-memory store gets retired as its data moves to DB (kept temporarily as fallback).