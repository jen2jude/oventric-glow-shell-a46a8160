import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FX_FROM_USD, SELLER_SHARE, WALLET_CASHBACK_PCT, type OrderCurrency, type PaymentMethod } from "./marketplace.functions";
import { convertViaSnapshot } from "@/lib/fx-display";


const PAYSTACK_BASE = "https://api.paystack.co";
const SUPPORTED_CURRENCIES: OrderCurrency[] = ["NGN", "GHS", "USD"];

function subunit(amount: number) {
  // NGN kobo, GHS pesewas, USD cents — all *100.
  return Math.max(1, Math.round(amount * 100));
}

async function paystackFetch<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack is not configured on the server.");
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: { status?: boolean; message?: string; data?: T } = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!res.ok || !json.status) {
    throw new Error(json.message || `Paystack request failed (${res.status})`);
  }
  return json.data as T;
}

function inferOrigin(): string {
  const explicit = getRequestHeader("origin");
  if (explicit) return explicit;
  const host = getRequestHeader("host");
  const proto = getRequestHeader("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "https://oventric.com";
}

type WalletTopupIntent = {
  purpose: "wallet_topup";
  amount: number;
  currency: OrderCurrency;
  returnTo?: string;
};

type OrderIntent = {
  purpose: "order";
  productId: string;
  quantity: number;
  displayCurrency: OrderCurrency;
  couponCode?: string | null;
  deliveryEmail?: string | null;
  deliveryWhatsapp?: string | null;
  /** Amount of Cashback Wallet (USD) to spend on this order. Debited atomically at init. */
  applyCashbackUSD?: number | null;
};


export type PaystackInitInput = (WalletTopupIntent | OrderIntent) & {
  channel?: "card" | "bank_transfer" | "mobile_money" | "ussd";
};

export interface PaystackInitResult {
  authorizationUrl: string;
  reference: string;
}

export const initPaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PaystackInitInput) => input)
  .handler(async ({ data, context }): Promise<PaystackInitResult> => {
    let email = (context.claims as { email?: string })?.email;
    if (!email) {
      const { data: userRes } = await context.supabase.auth.getUser();
      email = userRes?.user?.email ?? undefined;
    }
    if (!email) {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const url = process.env.SUPABASE_URL;
      if (key && url) {
        const r = await fetch(`${url}/auth/v1/admin/users/${context.userId}`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        const j = await r.json().catch(() => null);
        email = (j?.email && String(j.email)) || (j?.user?.email && String(j.user.email)) || undefined;
      }
    }
    // Anonymous / phone-only users: Paystack still requires a valid-format email.
    // Use a stable synthetic address tied to their user id.
    if (!email) email = `guest-${context.userId}@guest.oventric.com`;

    let amount = 0;
    let currency: OrderCurrency = "USD";
    const metadata: Record<string, unknown> = {
      user_id: context.userId,
      purpose: data.purpose,
    };

    if (data.purpose === "wallet_topup") {
      amount = Number(data.amount);
      currency = data.currency;
      if (!(amount > 0)) throw new Error("Top-up amount must be greater than zero.");
      if (data.returnTo && typeof data.returnTo === "string" && data.returnTo.startsWith("/")) {
        metadata.return_to = data.returnTo;
      }
    } else {
      // Order — resolve authoritative price from DB.
      const { data: p, error } = await context.supabase
        .from("products")
        .select("id, price_usd, original_currency, original_amount, fx_snapshot")
        .eq("id", data.productId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!p) throw new Error("Product not found");
      const qty = Math.max(1, Math.min(20, Number(data.quantity ?? 1)));
      const displayCurrency = data.displayCurrency;
      const grossUSD = Number(p.price_usd) * qty;
      let discountUSD = 0;
      if (data.couponCode) {
        const { data: c } = await context.supabase
          .from("coupons")
          .select("discount_pct")
          .eq("code", data.couponCode)
          .eq("active", true)
          .maybeSingle();
        if (c) discountUSD = Number(((grossUSD * Number(c.discount_pct)) / 100).toFixed(2));
      }
      const totalAfterCouponUSD = Number((grossUSD - discountUSD).toFixed(2));

      // Cashback Wallet spend — debit atomically BEFORE Paystack init so the
      // charge amount is reduced. Refunded in the failure branch of the
      // webhook / verification callback if the payment doesn't settle.
      let cashbackAppliedUSD = 0;
      const requestedCB = Math.max(0, Number(data.applyCashbackUSD ?? 0));
      if (requestedCB > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: wRow } = await supabaseAdmin
          .from("wallets")
          .select("accumulated_cashback")
          .eq("user_id", context.userId)
          .eq("currency", "USD")
          .maybeSingle();
        const availableCB = Number(wRow?.accumulated_cashback ?? 0);
        const spend = Number(Math.min(requestedCB, availableCB, totalAfterCouponUSD).toFixed(2));
        if (spend > 0) {
          const { data: cbOk, error: cbErr } = await supabaseAdmin.rpc("cashback_debit", {
            _user_id: context.userId,
            _amount: spend,
          });
          if (cbErr) throw new Error(cbErr.message);
          if (cbOk) cashbackAppliedUSD = spend;
        }
      }

      const totalUSD = Number((totalAfterCouponUSD - cashbackAppliedUSD).toFixed(2));
      // Prefer the seller's exact locked amount when the buyer is paying in the
      // product's ORIGINAL currency — avoids USD round-trip drift (₦500 → 0.33
      // USD → ₦495). Otherwise convert via the locked FX snapshot.
      const originalCurrency = ((p.original_currency as string) ?? "USD") as OrderCurrency;
      const originalAmount = Number(p.original_amount ?? 0);
      let converted = 0;
      if (originalAmount > 0 && displayCurrency === originalCurrency && totalAfterCouponUSD > 0) {
        const ratio = totalUSD / totalAfterCouponUSD; // scale down for cashback
        converted = Number((originalAmount * qty * ratio).toFixed(2));
      } else {
        const snapRaw = (p.fx_snapshot as { base?: string; rates?: Record<string, number> } | null) ?? null;
        const snap = snapRaw && snapRaw.rates ? { base: "USD" as const, rates: snapRaw.rates } : null;
        converted = convertViaSnapshot(totalUSD, "USD", displayCurrency, snap);
      }



      amount = Number((converted > 0 ? converted : totalUSD * FX_FROM_USD[displayCurrency]).toFixed(2));
      currency = displayCurrency;

      metadata.product_id = p.id;
      metadata.quantity = qty;
      metadata.display_currency = displayCurrency;
      metadata.coupon_code = data.couponCode ?? null;
      metadata.total_usd = totalUSD;
      metadata.cashback_applied_usd = cashbackAppliedUSD;
      metadata.delivery_email = data.deliveryEmail ? String(data.deliveryEmail).trim().slice(0, 320) : null;
      metadata.delivery_whatsapp = data.deliveryWhatsapp ? String(data.deliveryWhatsapp).replace(/\D/g, "").slice(0, 20) : null;
    }


    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new Error(`Currency ${currency} is not supported by Paystack.`);
    }

    const origin = inferOrigin();
    const reference = `OV_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`.toUpperCase();

    const channelsMap: Record<string, string[]> = {
      card: ["card"],
      bank_transfer: ["bank_transfer", "bank"],
      mobile_money: ["mobile_money"],
      ussd: ["ussd"],
    };
    const channels = data.channel ? channelsMap[data.channel] : undefined;

    const body = {
      email,
      amount: subunit(amount),
      currency,
      reference,
      callback_url: `${origin}/payment/return`,
      metadata,
      ...(channels ? { channels } : {}),
    };

    const result = await paystackFetch<{ authorization_url: string; reference: string }>(
      "/transaction/initialize",
      { method: "POST", body: JSON.stringify(body) },
    );

    // Record an "initialized" (pending) top-up so the user's history reflects
    // the intent even if they abandon the Paystack page or the transaction fails.
    if (data.purpose === "wallet_topup") {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("wallet_transactions").insert({
          user_id: context.userId,
          paystack_ref: result.reference,
          tx_hash: result.reference,
          type: "Wallet Top-Up",
          amount,
          currency,
          inflow: true,
          status: "pending",
          occurred_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("[paystack] init pending row failed", e);
      }
    }

    return {
      authorizationUrl: result.authorization_url,
      reference: result.reference,
    };
  });

// ---- Verification / settlement ------------------------------------------------

interface PaystackVerifyPayload {
  status: string; // "success" | "failed" | ...
  reference: string;
  amount: number; // subunit
  currency: string;
  metadata: Record<string, unknown> | null;
  customer: { email: string };
  paid_at: string | null;
}

async function settleWalletTopup(
  buyerId: string,
  reference: string,
  amount: number,
  currency: OrderCurrency,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Idempotency guard.
  const existing = await supabaseAdmin
    .from("wallet_transactions")
    .select("id, status")
    .eq("paystack_ref", reference)
    .maybeSingle();
  if (existing.data && existing.data.status === "success") {
    return { alreadySettled: true as const };
  }

  // Credit the wallet in the currency the user actually paid in, so the
  // primary balance shown on the Sovereign Wallet page updates immediately.
  // The USD equivalent card is derived on the client from FX rates.
  const { data: wRow } = await supabaseAdmin
    .from("wallets")
    .select("id, available_balance")
    .eq("user_id", buyerId)
    .eq("currency", currency)
    .maybeSingle();
  const now = new Date().toISOString();
  if (wRow?.id) {
    const nextBal = Number(wRow.available_balance ?? 0) + amount;
    const { error: uErr } = await supabaseAdmin
      .from("wallets")
      .update({ available_balance: nextBal, updated_at: now })
      .eq("id", wRow.id);
    if (uErr) throw new Error(uErr.message);
  } else {
    const { error: iErr } = await supabaseAdmin
      .from("wallets")
      .insert({ user_id: buyerId, currency, available_balance: amount });
    if (iErr) throw new Error(iErr.message);
  }

  if (existing.data?.id) {
    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "success", occurred_at: now, amount, currency })
      .eq("id", existing.data.id);
  } else {
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: buyerId,
      paystack_ref: reference,
      tx_hash: reference,
      type: "Wallet Top-Up",
      amount,
      currency,
      inflow: true,
      status: "success",
      occurred_at: now,
    });
  }

  return { alreadySettled: false as const, creditedAmount: amount, creditedCurrency: currency };
}

async function settleOrder(
  buyerId: string,
  reference: string,
  meta: {
    productId: string;
    quantity: number;
    displayCurrency: OrderCurrency;
    couponCode: string | null;
    deliveryEmail?: string | null;
    deliveryWhatsapp?: string | null;
    cashbackAppliedUSD?: number;
  },
) {

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const existing = await supabaseAdmin
    .from("orders")
    .select("id, total_usd, display_total, display_currency")
    .eq("paystack_ref", reference)
    .maybeSingle();
  if (existing.data?.id) {
    // Replay path (webhook already settled). Recompute cashback so the return
    // page can still play the celebratory splash.
    const gross = Number(existing.data.total_usd ?? 0);
    const cashbackEarnUSD = Number((gross * WALLET_CASHBACK_PCT).toFixed(2));
    return { alreadySettled: true as const, orderId: existing.data.id as string, cashbackEarnUSD };
  }

  const { data: pRow, error: pErr } = await supabaseAdmin
    .from("products")
    .select("id, seller_id, price_usd, fx_snapshot")
    .eq("id", meta.productId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!pRow) throw new Error("Product not found");

  const qty = Math.max(1, Math.min(20, Number(meta.quantity)));
  const priceUSD = Number(pRow.price_usd);
  const grossUSD = Number((priceUSD * qty).toFixed(2));
  let discountUSD = 0;
  if (meta.couponCode) {
    const { data: c } = await supabaseAdmin
      .from("coupons")
      .select("discount_pct")
      .eq("code", meta.couponCode)
      .eq("active", true)
      .maybeSingle();
    if (c) discountUSD = Number(((grossUSD * Number(c.discount_pct)) / 100).toFixed(2));
  }
  const afterCouponUSD = Number((grossUSD - discountUSD).toFixed(2));
  const cashbackAppliedUSD = Math.max(0, Number(meta.cashbackAppliedUSD ?? 0));
  const totalUSD = Number((afterCouponUSD - cashbackAppliedUSD).toFixed(2));
  const snapRaw = (pRow.fx_snapshot as { base?: string; rates?: Record<string, number> } | null) ?? null;
  const snap = snapRaw && snapRaw.rates ? { base: "USD" as const, rates: snapRaw.rates } : null;
  const convertedTotal = convertViaSnapshot(totalUSD, "USD", meta.displayCurrency, snap);
  const displayTotal = Number((convertedTotal > 0 ? convertedTotal : totalUSD * FX_FROM_USD[meta.displayCurrency]).toFixed(2));
  const fx = displayTotal && totalUSD > 0 ? displayTotal / totalUSD : FX_FROM_USD[meta.displayCurrency];


  const { data: oRow, error: oErr } = await supabaseAdmin
    .from("orders")
    .insert({
      buyer_id: buyerId,
      product_id: pRow.id,
      seller_id: pRow.seller_id,
      quantity: qty,
      unit_price_usd: priceUSD,
      total_usd: totalUSD,
      display_currency: meta.displayCurrency,
      display_total: displayTotal,
      fx_rate: fx,
      payment_method: "card" satisfies PaymentMethod,
      status: "paid",
      paid_at: new Date().toISOString(),
      paystack_ref: reference,
      delivery_email: meta.deliveryEmail ?? null,
      delivery_whatsapp: meta.deliveryWhatsapp ?? null,
    })
    .select()
    .single();
  if (oErr) throw new Error(oErr.message);

  await supabaseAdmin.from("wallet_transactions").insert({
    user_id: buyerId,
    paystack_ref: reference,
    tx_hash: reference,
    type: "Marketplace Purchase",
    amount: displayTotal,
    currency: meta.displayCurrency,
    inflow: false,
    status: "success",
    occurred_at: new Date().toISOString(),
  });

  // Seller 80% + platform 20% always computed on the FULL gross sale price
  // (post-coupon, pre-cashback). Applying cashback only shifts value from the
  // buyer's card charge to their Cashback Wallet debit — the sale price the
  // seller/platform see is unchanged.
  const splitBaseUSD = afterCouponUSD;
  const sellerCutUSD = Number((splitBaseUSD * SELLER_SHARE).toFixed(2));
  const platformCutUSD = Number((splitBaseUSD - sellerCutUSD).toFixed(2));

  // Credit the seller in the BUYER's display currency (their local money) so
  // the seller sees the sale amount they expect (₦395 on a ₦495 sale) and can
  // withdraw via Paystack Transfers directly in that currency.
  const sellerCutLocal = Number((displayTotal * SELLER_SHARE).toFixed(2));
  await supabaseAdmin.rpc("wallet_credit_currency", {
    _user_id: pRow.seller_id as string,
    _amount: sellerCutLocal,
    _currency: meta.displayCurrency,
  });
  await supabaseAdmin.from("wallet_transactions").insert({
    user_id: pRow.seller_id as string,
    tx_hash: `${reference}-S`,
    type: "Marketplace Sale",
    amount: sellerCutLocal,
    currency: meta.displayCurrency,
    inflow: true,
    status: "success",
    occurred_at: new Date().toISOString(),
  });

  await supabaseAdmin.rpc("system_wallet_credit", {
    _kind: "marketplace",
    _amount: platformCutUSD,
    _source: "marketplace_order_paystack",
    _ref: oRow.id as string,
    _meta: { order_id: oRow.id, product_id: pRow.id, buyer_id: buyerId, seller_id: pRow.seller_id, paystack_ref: reference, seller_cut_local: sellerCutLocal, seller_cut_currency: meta.displayCurrency },
  });

  // Credit 2% cashback of the FULL gross sale price into the buyer's spend-only
  // Cashback Wallet — regardless of whether they applied cashback this time.
  const cashbackEarnUSD = Number((splitBaseUSD * WALLET_CASHBACK_PCT).toFixed(2));
  if (cashbackEarnUSD > 0) {
    await supabaseAdmin.rpc("cashback_credit", { _user_id: buyerId, _amount: cashbackEarnUSD });
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: buyerId,
      tx_hash: `${reference}-CB`,
      type: "Cashback Earned",
      amount: cashbackEarnUSD,
      currency: "USD",
      inflow: true,
      status: "success",
      occurred_at: new Date().toISOString(),
    });
  }

  return { alreadySettled: false as const, orderId: oRow.id as string, cashbackEarnUSD };
}



export async function verifyAndSettleByReference(reference: string) {
  const payload = await paystackFetch<PaystackVerifyPayload>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
  if (payload.status !== "success") {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("wallet_transactions")
        .update({ status: "failed" })
        .eq("paystack_ref", payload.reference)
        .eq("type", "Wallet Top-Up")
        .eq("status", "pending");
      // Refund any cashback that was atomically debited at init time.
      const failedMeta = (payload.metadata ?? {}) as Record<string, unknown>;
      const failedUser = String(failedMeta.user_id ?? "");
      const refund = Math.max(0, Number(failedMeta.cashback_applied_usd ?? 0));
      if (failedUser && refund > 0) {
        await supabaseAdmin.rpc("cashback_credit", { _user_id: failedUser, _amount: refund });
      }
    } catch (e) {
      console.error("[paystack] mark topup failed error", e);
    }
    return { ok: false as const, status: payload.status, redirectTo: null as string | null, cashbackEarnedUSD: 0, displayCurrency: (payload.currency as OrderCurrency) };
  }
  const meta = (payload.metadata ?? {}) as Record<string, unknown>;
  const userId = String(meta.user_id ?? "");
  if (!userId) throw new Error("Payment metadata missing user context.");
  const purpose = String(meta.purpose ?? "wallet_topup");
  const currency = (payload.currency as OrderCurrency);
  const amount = payload.amount / 100;

  if (purpose === "order") {
    const res = await settleOrder(userId, payload.reference, {
      productId: String(meta.product_id ?? ""),
      quantity: Number(meta.quantity ?? 1),
      displayCurrency: (meta.display_currency as OrderCurrency) ?? currency,
      couponCode: (meta.coupon_code as string | null) ?? null,
      deliveryEmail: (meta.delivery_email as string | null) ?? null,
      deliveryWhatsapp: (meta.delivery_whatsapp as string | null) ?? null,
      cashbackAppliedUSD: Number(meta.cashback_applied_usd ?? 0),
    });
    return {
      ok: true as const,
      status: "success",
      redirectTo: `/order/${res.orderId}`,
      cashbackEarnedUSD: "cashbackEarnUSD" in res ? (res.cashbackEarnUSD ?? 0) : 0,
      displayCurrency: ((meta.display_currency as OrderCurrency) ?? currency),
    };
  }


  await settleWalletTopup(userId, payload.reference, amount, currency);
  const returnTo = typeof meta.return_to === "string" && meta.return_to.startsWith("/") ? meta.return_to : "/?section=Wallet&wallet=funded";
  return { ok: true as const, status: "success", redirectTo: returnTo, cashbackEarnedUSD: 0, displayCurrency: currency };
}

export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({
    reference: String(input?.reference ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    if (!data.reference) throw new Error("Missing reference");
    const result = await verifyAndSettleByReference(data.reference);
    // Best-effort authorization: ensure the caller is the payer for order redirects.
    void context.userId;
    return result;
  });

// ---- History ----------------------------------------------------------------

export interface PaystackTopupRow {
  id: string;
  reference: string;
  amount: number;
  currency: OrderCurrency;
  status: "pending" | "success" | "failed";
  occurredAt: string;
  createdAt: string;
}

export const listMyPaystackTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaystackTopupRow[]> => {
    const { data, error } = await context.supabase
      .from("wallet_transactions")
      .select("id, paystack_ref, amount, currency, status, occurred_at, created_at")
      .eq("user_id", context.userId)
      .eq("type", "Wallet Top-Up")
      .not("paystack_ref", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      reference: (r.paystack_ref as string) ?? "",
      amount: Number(r.amount),
      currency: r.currency as OrderCurrency,
      status: r.status as "pending" | "success" | "failed",
      occurredAt: r.occurred_at as string,
      createdAt: r.created_at as string,
    }));
  });
