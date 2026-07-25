// Server-only helpers for Paystack Transfers API + fee estimation.
// This file MUST NOT be imported from client-reachable modules; it is used
// only inside createServerFn handlers and server routes.

const PAYSTACK_BASE = "https://api.paystack.co";

export type TransferCurrency = "NGN" | "GHS";
export type TransferMethod = "bank" | "momo";

async function ps<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<T> {
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
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok || !json.status) {
    throw new Error(json.message || `Paystack request failed (${res.status})`);
  }
  return json.data as T;
}

export interface PaystackBank {
  name: string;
  code: string;
  country: string;
  currency: string;
  type: string;
  active: boolean;
}

export async function listBanks(currency: TransferCurrency): Promise<PaystackBank[]> {
  const country = currency === "NGN" ? "nigeria" : "ghana";
  const data = await ps<PaystackBank[]>(
    `/bank?country=${country}&perPage=100`,
    { method: "GET" },
  );
  return (Array.isArray(data) ? data : []).filter((b) => b.active !== false);
}

export interface ResolvedAccount {
  account_number: string;
  account_name: string;
}

export async function resolveAccount(input: {
  account_number: string;
  bank_code: string;
}): Promise<ResolvedAccount> {
  const q = `account_number=${encodeURIComponent(input.account_number)}&bank_code=${encodeURIComponent(input.bank_code)}`;
  return ps<ResolvedAccount>(`/bank/resolve?${q}`, { method: "GET" });
}

export interface CreatedRecipient {
  recipient_code: string;
  active: boolean;
}

export async function createTransferRecipient(input: {
  type: "nuban" | "ghipss" | "mobile_money";
  name: string;
  account_number: string;
  bank_code: string;
  currency: TransferCurrency;
}): Promise<CreatedRecipient> {
  const data = await ps<CreatedRecipient>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data;
}

export interface InitiatedTransfer {
  transfer_code: string;
  reference: string;
  status: string; // "success" | "pending" | "otp"
}

export async function initiateTransfer(input: {
  amountSubunit: number; // in kobo/pesewas
  recipient_code: string;
  reason: string;
  reference: string;
  signal?: AbortSignal;
}): Promise<InitiatedTransfer> {
  const body = {
    source: "balance",
    amount: input.amountSubunit,
    recipient: input.recipient_code,
    reason: input.reason,
    reference: input.reference,
  };
  return ps<InitiatedTransfer>("/transfer", {
    method: "POST",
    body: JSON.stringify(body),
    signal: input.signal,
  });
}

/**
 * Paystack transfer-fee estimator (Nigeria + Ghana).
 * These are billed to the merchant's Paystack balance; we deduct the fee
 * from the user's requested amount so the recipient bank gets the net.
 * Kept in one place so client preview + server settlement stay in sync.
 */
export function estimateTransferFee(currency: TransferCurrency, method: TransferMethod, amount: number): number {
  if (currency === "NGN") {
    // NG bank transfer fee tiers.
    if (amount <= 5_000) return 10;
    if (amount <= 50_000) return 25;
    return 50;
  }
  // GHS
  if (method === "momo") {
    // 1% capped at GHS 8, plus GHS 1 base.
    const pct = Math.min(amount * 0.01, 8);
    return Number((pct + 1).toFixed(2));
  }
  // GHS bank
  return 1;
}

export function toSubunit(amount: number): number {
  return Math.max(1, Math.round(amount * 100));
}
