
# Physical Marketplace — Major Update

Scope is large; I'll ship it in one coherent pass. Here's what will change and how.

## 1. Database (single migration)

Extend `products` (keep digital flow intact) with:
- `kind` text — `'digital' | 'physical'` (default `'digital'`)
- `condition` text — `'new' | 'used'` (nullable)
- `brand` text (nullable)
- `location` text (nullable)
- `negotiable` text — `'yes' | 'no' | 'maybe'`
- `delivery` text — `'yes' | 'no' | 'maybe'`
- `seller_phone` text (E.164 digits, physical only)
- `whatsapp_number` text (same digits, used for wa.me link)
- `social_link` text (optional YouTube/Facebook)
- `image_urls` text[] (cover = index 0, min 3 for physical)
- `subcategory` text (nullable)
- `status` — ensure `'pending' | 'active' | 'rejected'` allowed
- `reject_reason` text (nullable)

RLS: public SELECT only when `status='active'`; owners can see their own regardless; admins see all. Physical products never require file downloads.

## 2. Marketplace UI (`Marketplace.tsx`)

- Add a **segmented toggle** at the top: `Digital ⇆ Physical` with the same smooth animated switch used in the onboarding "Let's get started" modal.
- Default: Digital. State persists in `localStorage`.
- Replace the "View all" glowing rectangular button with a **round RGB-animated button** matching the `+` create button style.
- Digital view: unchanged (categories + products as-is).
- Physical view: physical categories rail + physical product cards (same card chrome, no "digital download" affordance).

## 3. Product page (`product.$id.tsx`)

- If `kind='physical'` → replace **Buy Now** with **Contact Seller**.
- On click: modal with disclaimer text:
  > You will be redirected to deal with the seller directly. Take precaution — Oventric does not monitor or mediate between buyers and sellers.
- Two buttons:
  - **Call Seller** → `tel:${seller_phone}`
  - **Chat on WhatsApp** → `https://wa.me/${whatsapp_number}?text=<prefilled>` where prefilled = `Hi! I saw your product "<name>" (<price>) — <product URL>. I'd like to purchase it.`
- Additional images (2+) become a toggleable gallery on the product page.

## 4. Sell flow (from `+` button)

- Rename entry to just **Sell**. On click opens a **switchable modal** (same smooth toggle) with two tabs:
  - **Digital Assets** → existing `SellAssetModal` form untouched.
  - **Physical Goods** → new `SellPhysicalModal`:
    - Title
    - Category (dropdown) → on select, subcategory picker with category image
    - Location
    - Images (min 3, first = cover, drag-reorder)
    - Social video link (optional)
    - Brand (optional)
    - Condition (Brand New / Used) — pill buttons
    - Description
    - Price (locked to seller's base currency, same FX snapshot as digital)
    - Negotiable (Yes / No / Maybe)
    - Delivery (Yes / No / Maybe)
    - Phone number (digits only, validated)
    - **Save draft** / **Post product**
- On Post: server fn inserts with `status='pending'`, then shows a success modal:
  > Your product has been published for review. It will go live once an admin approves it. Note: you might be contacted if needed.
  > [OK → home]

## 5. Admin

- **Admin → Products**: single tab list showing both digital and physical (filter chip: All / Digital / Physical / Pending / Active / Rejected).
- Row actions: **View**, **Approve** (sets `status='active'`), **Reject** (opens dialog for reason + optional recommendation).
- Reject sends a **system direct message / notification** to the seller with the reason + recommendation (uses the existing notifications table, kind `system`).
- Admin Sell form: same two-mode modal as user side, so admins can post either type directly (auto-approved).

## 6. Admin Users tab fix

- `admin.users.tsx` doesn't load real users. Fix the server fn to page real profiles via `supabaseAdmin` (list all profile rows joined with `auth.users` for email/created_at, filtered by admin role gate).

## Confirmation on the WhatsApp model

Your model works. One clarification: `wa.me` requires **international format without `+` or leading zero** (e.g. `2348012345678`). I'll enforce a country-code prefix in the phone field (default from seller's profile country) so WhatsApp always opens correctly. The dialer `tel:` link accepts the same format.

## Files touched (approx.)

- Migration: `products` table + RLS + notifications kind allowlist if needed
- New: `src/components/oventric/SellPhysicalModal.tsx`, `src/components/oventric/PhysicalMarketplace.tsx`, `src/components/oventric/ContactSellerModal.tsx`, `src/components/oventric/MarketplaceModeToggle.tsx`
- Edited: `Marketplace.tsx`, `CreatePanel.tsx` (Sell entry), `product.$id.tsx`, `admin.products.tsx`, `admin.users.tsx`, `src/lib/marketplace.functions.ts`, `src/lib/admin.functions.ts`

Reply **go** to build it, or tell me what to adjust (categories list for physical, currency handling, whether admin-posted products should auto-approve, etc.).
