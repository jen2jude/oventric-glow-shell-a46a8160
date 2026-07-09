import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type ProductCategory = "themes" | "plugins" | "blocks" | "scripts";
export type OrderCurrency = "USD" | "NGN" | "GHS";
export type PaymentMethod = "wallet" | "card" | "bank_transfer" | "mobile_money";
export type OrderStatus = "pending" | "paid" | "failed" | "refunded";

export interface ProductDTO {
  id: string;
  sellerId: string;
  name: string;
  category: ProductCategory;
  description: string;
  priceUSD: number;
  hue: string;
  vendor: string;
  rating: number;
  reviews: number;
  promoted: boolean;
  externalUrl: string | null;
  filePath: string | null;
  createdAt: string;
}

export interface OrderDTO {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  vendor: string;
  hue: string;
  quantity: number;
  unitPriceUSD: number;
  totalUSD: number;
  displayCurrency: OrderCurrency;
  displayTotal: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  downloadToken: string;
  createdAt: string;
  paidAt: string | null;
  externalUrl: string | null;
  filePath: string | null;
}

export const FX_FROM_USD: Record<OrderCurrency, number> = { USD: 1, NGN: 1500, GHS: 14 };

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function mapProduct(r: Record<string, unknown>): ProductDTO {
  return {
    id: r.id as string,
    sellerId: r.seller_id as string,
    name: r.name as string,
    category: r.category as ProductCategory,
    description: (r.description as string) ?? "",
    priceUSD: Number(r.price_usd),
    hue: (r.hue as string) ?? "from-emerald-500 to-teal-700",
    vendor: r.vendor as string,
    rating: Number(r.rating),
    reviews: Number(r.reviews),
    promoted: Boolean(r.promoted),
    externalUrl: (r.external_url as string) ?? null,
    filePath: (r.file_path as string) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Public catalog. Anyone (including anon) can list. */
export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublicClient();
  const { data, error } = await sb
    .from("products")
    .select("id, seller_id, name, category, description, price_usd, hue, vendor, rating, reviews, promoted, external_url, file_path, created_at")
    .order("promoted", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProduct);
});

/** Public product detail. */
export const getProduct = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data }) => {
    if (!data.id) throw new Error("Product id required");
    const sb = serverPublicClient();
    const { data: row, error } = await sb
      .from("products")
      .select("id, seller_id, name, category, description, price_usd, hue, vendor, rating, reviews, promoted, external_url, file_path, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Product not found");
    return mapProduct(row as Record<string, unknown>);
  });

/** Authenticated seller creates a product (used by Admin Forge). */
export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    name: string;
    category: ProductCategory;
    description: string;
    priceUSD: number;
    vendor: string;
    hue?: string;
    externalUrl?: string | null;
  }) => ({
    name: String(input.name ?? "").trim(),
    category: input.category,
    description: String(input.description ?? "").trim(),
    priceUSD: Number(input.priceUSD),
    vendor: String(input.vendor ?? "").trim(),
    hue: input.hue ?? "from-emerald-500 to-teal-700",
    externalUrl: input.externalUrl ?? null,
  }))
  .handler(async ({ data, context }) => {
    if (!data.name) throw new Error("Name required");
    if (!(data.priceUSD > 0)) throw new Error("Price must be > 0");
    const { data: row, error } = await context.supabase
      .from("products")
      .insert({
        seller_id: context.userId,
        name: data.name,
        category: data.category,
        description: data.description,
        price_usd: data.priceUSD,
        vendor: data.vendor,
        hue: data.hue,
        external_url: data.externalUrl,
        promoted: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapProduct(row as Record<string, unknown>);
  });

/** Wallet top-up (mock card/bank/momo processing). Credits the user's wallet in USD equivalent. */
export const topUpWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    amount: number;
    currency: OrderCurrency;
    method: PaymentMethod;
  }) => ({
    amount: Number(input.amount),
    currency: input.currency,
    method: input.method,
  }))
  .handler(async ({ data, context }) => {
    if (!(data.amount > 0)) throw new Error("Amount must be > 0");
    if (data.method === "wallet") throw new Error("Cannot top up wallet from wallet");
    const usd = data.amount / FX_FROM_USD[data.currency];

    // Simulated card / bank / momo processing.
    const { error: cErr } = await context.supabase.rpc("wallet_credit", {
      _user_id: context.userId,
      _amount: usd,
    });
    if (cErr) throw new Error(cErr.message);

    await context.supabase.from("wallet_transactions").insert({
      user_id: context.userId,
      tx_hash: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`,
      type: "Wallet Top-Up",
      amount: data.amount,
      currency: data.currency,
      inflow: true,
      status: "success",
      occurred_at: new Date().toISOString(),
    });

    return { creditedUSD: usd };
  });

export interface CreateOrderInput {
  productId: string;
  quantity: number;
  displayCurrency: OrderCurrency;
  paymentMethod: PaymentMethod;
}

export interface CreateOrderResult {
  order: OrderDTO;
  walletShortfallUSD?: number;
}

/** Create + settle an order. Wallet method debits balance atomically. */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateOrderInput) => ({
    productId: String(input.productId ?? ""),
    quantity: Math.max(1, Math.min(20, Number(input.quantity ?? 1))),
    displayCurrency: (input.displayCurrency ?? "USD") as OrderCurrency,
    paymentMethod: (input.paymentMethod ?? "wallet") as PaymentMethod,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pRow, error: pErr } = await supabase
      .from("products")
      .select("id, seller_id, name, category, description, price_usd, hue, vendor, rating, reviews, promoted, external_url, file_path, created_at")
      .eq("id", data.productId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pRow) throw new Error("Product not found");
    const product = mapProduct(pRow as Record<string, unknown>);

    const totalUSD = Number((product.priceUSD * data.quantity).toFixed(2));
    const fx = FX_FROM_USD[data.displayCurrency];
    const displayTotal = Number((totalUSD * fx).toFixed(2));

    // Try to debit wallet if wallet method.
    if (data.paymentMethod === "wallet") {
      const { data: ok, error: dErr } = await supabase.rpc("wallet_debit", {
        _user_id: userId,
        _amount: totalUSD,
      });
      if (dErr) throw new Error(dErr.message);
      if (!ok) {
        const { data: w } = await supabase
          .from("wallets")
          .select("available_balance")
          .eq("user_id", userId)
          .eq("currency", "USD")
          .maybeSingle();
        const bal = Number(w?.available_balance ?? 0);
        return {
          order: null as unknown as OrderDTO,
          walletShortfallUSD: Number((totalUSD - bal).toFixed(2)),
        } as CreateOrderResult;
      }
    } else {
      // Card / bank / momo: mock immediate settlement — funds move directly to seller ledger.
      // (No wallet debit for buyer.)
    }

    const { data: oRow, error: oErr } = await supabase
      .from("orders")
      .insert({
        buyer_id: userId,
        product_id: product.id,
        seller_id: product.sellerId,
        quantity: data.quantity,
        unit_price_usd: product.priceUSD,
        total_usd: totalUSD,
        display_currency: data.displayCurrency,
        display_total: displayTotal,
        fx_rate: fx,
        payment_method: data.paymentMethod,
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (oErr) throw new Error(oErr.message);

    // Ledger entry for buyer.
    await supabase.from("wallet_transactions").insert({
      user_id: userId,
      tx_hash: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`,
      type: "Marketplace Purchase",
      amount: displayTotal,
      currency: data.displayCurrency,
      inflow: false,
      status: "success",
      occurred_at: new Date().toISOString(),
    });

    // Credit seller wallet in USD.
    await supabase.rpc("wallet_credit", {
      _user_id: product.sellerId,
      _amount: totalUSD,
    });

    return {
      order: {
        id: oRow.id as string,
        productId: product.id,
        productName: product.name,
        category: product.category,
        vendor: product.vendor,
        hue: product.hue,
        quantity: data.quantity,
        unitPriceUSD: product.priceUSD,
        totalUSD,
        displayCurrency: data.displayCurrency,
        displayTotal,
        paymentMethod: data.paymentMethod,
        status: "paid",
        downloadToken: oRow.download_token as string,
        createdAt: oRow.created_at as string,
        paidAt: oRow.paid_at as string,
        externalUrl: product.externalUrl,
        filePath: product.filePath,
      },
    } as CreateOrderResult;
  });

/** Load an order for the buyer, with a signed download URL if applicable. */
export const getOrderWithDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => ({ orderId: String(input.orderId ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: o, error } = await supabase
      .from("orders")
      .select("*, products:product_id (name, category, vendor, hue, external_url, file_path)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) throw new Error("Order not found");
    if ((o.buyer_id as string) !== userId) throw new Error("Not your order");

    const product = (o.products ?? {}) as Record<string, unknown>;
    let downloadUrl: string | null = null;
    const filePath = (product.file_path as string) ?? null;
    if (o.status === "paid" && filePath) {
      const { data: signed } = await supabase.storage
        .from("product-files")
        .createSignedUrl(filePath, 60 * 60);
      downloadUrl = signed?.signedUrl ?? null;
    }

    return {
      order: {
        id: o.id as string,
        productId: o.product_id as string,
        productName: (product.name as string) ?? "Digital product",
        category: (product.category as ProductCategory) ?? "themes",
        vendor: (product.vendor as string) ?? "",
        hue: (product.hue as string) ?? "from-emerald-500 to-teal-700",
        quantity: Number(o.quantity),
        unitPriceUSD: Number(o.unit_price_usd),
        totalUSD: Number(o.total_usd),
        displayCurrency: o.display_currency as OrderCurrency,
        displayTotal: Number(o.display_total),
        paymentMethod: o.payment_method as PaymentMethod,
        status: o.status as OrderStatus,
        downloadToken: o.download_token as string,
        createdAt: o.created_at as string,
        paidAt: (o.paid_at as string) ?? null,
        externalUrl: (product.external_url as string) ?? null,
        filePath,
      } satisfies OrderDTO,
      downloadUrl,
    };
  });
