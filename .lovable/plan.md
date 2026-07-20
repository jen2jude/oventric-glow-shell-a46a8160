
# Campaigns Dashboard — Meta-Ads style (Admin-only, v1)

Build a robust admin-only campaign system with 3 creative tiers, wallet-funded daily budgets, NG/GH city targeting, and full delivery tracking. Self-serve advertiser onboarding stays off for now; hooks are left in place for phase 2.

## 1. Data model (new / extended tables)

```text
ad_campaigns  (extend existing)
  id, advertiser_name, advertiser_email, advertiser_whatsapp
  tier: 'text' | 'image' | 'video'
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'ended' | 'rejected'
  header, description, body
  cta_type: 'whatsapp' | 'lead_form' | 'url'
  cta_label, cta_url, cta_whatsapp, cta_lead_email
  placements text[]  -- feed | marketplace | academy | bounties
  countries text[]   -- ['NG','GH','US',...]
  cities text[]      -- ['Lagos','Abuja','Accra',...]
  daily_budget_usd numeric
  total_budget_usd numeric
  spent_usd numeric default 0
  start_at, end_at timestamptz
  priority int default 0        -- admin promote / boost
  created_by uuid, created_at, updated_at

ad_creatives            -- 1:N (carousel + video assets)
  id, campaign_id, kind: 'image'|'video'
  path, mime, width, height, duration_s, sort_order

ad_targets_cities       -- reference table
  country_code, city, region, active
  (seeded with NG + GH majors; admin manages more)

ad_events               -- append-only impression/click log
  id, campaign_id, kind: 'impression'|'click'|'lead'
  user_id nullable, session_id, placement, country, city
  cost_usd numeric, occurred_at

ad_leads                -- lead-form submissions
  id, campaign_id, name, email, phone, message, meta jsonb, created_at
  digest_sent_at nullable

ad_daily_spend          -- per campaign per day, for budget guard
  campaign_id, day date, spent_usd, impressions, clicks
  primary key (campaign_id, day)
```

RLS: admin-only writes everywhere. Public `SELECT` on active `ad_campaigns` restricted via SECURITY DEFINER `list_serving_ads(placement, country, city)` that returns only currently-serving campaigns + their creatives. Lead inserts allowed for anon via a SECURITY DEFINER `submit_ad_lead(...)`.

Storage: new private bucket `ad-media` (100 MB max, video ≤ 5 min, image ≤ 5 MB, up to 10 images for carousel). Server validates size + duration server-side after upload.

## 2. Billing — wallet-funded daily budget

- Advertiser is a real user with a Sovereign Wallet. Admin selects the advertiser (or creates a "house" advertiser profile) when creating the campaign.
- On **campaign activation**: lock `total_budget_usd` from wallet available → escrow (new `wallet_transactions` type `Campaign Escrow`).
- **Daily debit cron** (pg_cron, hourly): for each active campaign, credit platform system wallet with that day's `spent_usd` up to `daily_budget_usd`; when total spend hits `total_budget_usd` or `end_at` passes → status `ended`, refund remaining escrow.
- **Impression pricing** flat per-tier (admin-editable in `platform_settings`):
  - text: $0.0005/imp
  - image: $0.002/imp
  - video: $0.006/imp
  - click multiplier ×5 on top
- Daily budget is a hard cap: `list_serving_ads` filters out campaigns whose today-spend ≥ daily budget.

## 3. Server functions (`src/lib/campaigns.functions.ts`)

Admin-only (via `requireSupabaseAuth` + `has_role admin`):
- `listCampaigns(filter)` — table with KPIs (spend, impressions, CTR, leads).
- `getCampaign(id)` — full detail incl. creatives, daily spend series, recent events, leads.
- `upsertCampaign(input)` — validates tier ↔ required fields with zod.
- `activateCampaign(id)` — locks wallet, moves to `active`.
- `pauseCampaign(id)` / `endCampaign(id)` — refunds unspent escrow.
- `addCreative(campaignId, path, kind, meta)` / `removeCreative(id)`.
- `listCities(country)` / `upsertCity(...)` / `deleteCity(...)`.
- `campaignAnalytics(id, range)` — impressions/clicks/leads/spend by day.
- `exportLeadsCsv(campaignId)`.

Public (via `/api/public/*` server routes, no auth):
- `POST /api/public/ads/impression` — batches impression events (client sends beacon).
- `POST /api/public/ads/click` — logs click + redirects.
- `POST /api/public/ads/lead` — validates + writes `ad_leads`.
- `GET  /api/public/ads/serve?placement=&country=&city=` — returns weighted campaign + creatives (already used indirectly by SSR; browser can also call for hydration).

## 4. Delivery — client side

- New `src/lib/ads/useServingAds.ts` — fetches serving ads for a placement + user geo (from profile country/city, fallback IP inferred server-side).
- New `src/components/oventric/ads/AdSlot.tsx` — renders correct tier variant, sends impression on view via `IntersectionObserver`, click routes through `/api/public/ads/click?c=<id>` with 302 to real destination.
- Tier renderers:
  - `AdTextCard.tsx` — header + description + body + CTA button.
  - `AdImageCard.tsx` — 1:1 media (single or swipe carousel), header + description + CTA. Uses `ResponsiveImage`.
  - `AdVideoCard.tsx` — header, description, body, `<video>` (poster + click-to-play, muted autoplay when in view, mute toggle), CTA under.
- Feed / Marketplace / Academy already have ad hooks; swap the placeholder `AdCard` for new `AdSlot`.

## 5. Admin dashboard UI (`/admin/campaigns`)

Replace current minimal editor with a Meta-Ads-style workspace:

```text
┌──────────────────────────────────────────────────────────────┐
│ KPI strip: Active | Today's spend | Impressions | CTR | Leads│
├──────────┬───────────────────────────────────────────────────┤
│ Filters  │ Campaigns table                                    │
│ Tier     │  Name · Advertiser · Tier · Placements · Status    │
│ Status   │  · Budget · Spend · Impr · CTR · Leads · Actions   │
│ Country  │                                                    │
│ Date     │  Row click → Detail drawer                         │
└──────────┴───────────────────────────────────────────────────┘
```

Actions per row: Edit, Activate, Pause, End, Duplicate, View leads, Delete.

Detail drawer tabs:
1. **Overview** — spend/impr/CTR/leads sparkline, daily bars.
2. **Creative** — tier-specific editor with live preview beside it, media manager (upload/remove, reorder for carousel).
3. **Targeting** — country multi-select (NG, GH, others), city chips per country (loaded from `ad_targets_cities`), placements checkboxes.
4. **Budget & schedule** — daily budget, total budget, start/end, priority.
5. **CTA** — radio for whatsapp/lead_form/url + fields, plus daily-digest email address for leads.
6. **Leads** — table + CSV export.
7. **Events** — recent impressions/clicks (debug/audit).

Sibling admin page `/admin/campaigns/cities` — CRUD for the city dictionary. Seed with major cities:
- NG: Lagos, Abuja, Kano, Ibadan, Port Harcourt, Benin City, Kaduna, Enugu, Warri, Uyo, Owerri, Jos, Ilorin, Abeokuta, Calabar.
- GH: Accra, Kumasi, Takoradi, Tamale, Cape Coast, Sunyani, Ho, Koforidua, Tema.
- Placeholder "Others (USD)" catch-all.

## 6. Lead digest email

- New pg_cron (daily 08:00 UTC) → `POST /api/public/hooks/ads-lead-digest` (apikey-guarded).
- Route groups yesterday's `ad_leads` per campaign, renders a React Email template listing rows, sends via existing Lovable email queue, marks `digest_sent_at`.

## 7. Rollout order

1. Migration: new tables, seeds, RLS, GRANTs, RPCs, cron scaffolding.
2. Storage bucket `ad-media` + policies (admin write, signed read for player).
3. Server functions + public API routes.
4. Admin UI (list + drawer + city manager).
5. Public `AdSlot` + tier renderers, swap in Feed/Marketplace/Academy.
6. Impression/click tracking + daily debit cron.
7. Lead digest email + CSV export.

Out of scope for v1 (documented in code comments as phase 2): self-serve advertiser signup, ad review workflow for external users, CPM auction pricing, custom audiences, interest targeting, A/B split tests.

## Notes for you (non-technical summary)

- Only admins create/manage campaigns. Advertisers can just supply the info; you input it.
- Every campaign is paid up-front from a wallet you nominate; unused budget refunds automatically when a campaign pauses or ends.
- You get a Meta-Ads-style table with live spend/impression/CTR/lead counts and a right-side drawer to edit everything.
- Cities are managed in a separate screen so you can grow the list beyond the NG + GH seed without deploys.
- Lead-form CTAs collect submissions and email the advertiser once a day automatically.
- Video ads are capped at 5 min / 100 MB, images at 5 MB and 1:1, carousels up to 10 images.
