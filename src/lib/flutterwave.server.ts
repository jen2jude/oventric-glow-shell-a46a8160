// Server-only Flutterwave client (v3 API).
//
// MUST NOT be imported from client-reachable modules — it reads secrets from
// process.env. Import it dynamically inside createServerFn handlers / server
// route handlers only.

const FW_BASE = "https://api.flutterwave.com/v3";

function secret(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("Flutterwave is not configured on the server.");
  return key;
}

export function flutterwaveConfigured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}

async function fw<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${FW_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: { status?: string; message?: string; data?: T } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok || json.status !== "success") {
    throw new Error(json.message || `Flutterwave request failed (${res.status})`);
  }
  return json.data as T;
}

// ---- Hosted checkout ---------------------------------------------------------

export interface FlutterwaveInitInput {
  reference: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  email: string;
  name?: string;
  phone?: string;
  title?: string;
  description?: string;
  /** Restrict the payment options shown on the hosted page. */
  paymentOptions?: string;
  meta: Record<string, unknown>;
}

export async function createHostedPayment(input: FlutterwaveInitInput): Promise<{ link: string }> {
  const body = {
    tx_ref: input.reference,
    amount: Number(input.amount.toFixed(2)),
    currency: input.currency,
    redirect_url: input.redirectUrl,
    payment_options: input.paymentOptions,
    customer: {
      email: input.email,
      name: input.name || undefined,
      phonenumber: input.phone || undefined,
    },
    customizations: {
      title: input.title || "Oventric",
      description: input.description || "Secure payment",
    },
    meta: input.meta,
  };
  return fw<{ link: string }>("/payments", { method: "POST", body: JSON.stringify(body) });
}

export interface FlutterwaveTransaction {
  id: number;
  tx_ref: string;
  status: string; // "successful" | "failed" | "pending"
  amount: number;
  charged_amount: number;
  currency: string;
  customer: { email: string; name?: string };
  meta: Record<string, unknown> | null;
  created_at: string;
}

/** Verify by our own reference (tx_ref) — safest for the return page. */
export async function verifyByReference(reference: string): Promise<FlutterwaveTransaction> {
  return fw<FlutterwaveTransaction>(
    `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
}

/** Verify by Flutterwave's numeric transaction id (used by webhooks). */
export async function verifyById(id: number | string): Promise<FlutterwaveTransaction> {
  return fw<FlutterwaveTransaction>(`/transactions/${encodeURIComponent(String(id))}/verify`, {
    method: "GET",
  });
}

// ---- Transfers (payouts) -----------------------------------------------------

export interface FlutterwaveBank {
  id: number;
  code: string;
  name: string;
}

/** ISO-2 country code, e.g. NG, GH, KE, UG, TZ, ZA, RW. */
export async function listBanks(country: string): Promise<FlutterwaveBank[]> {
  const data = await fw<FlutterwaveBank[]>(`/banks/${encodeURIComponent(country.toUpperCase())}`, {
    method: "GET",
  });
  return Array.isArray(data) ? data : [];
}

export async function resolveAccount(input: {
  account_number: string;
  account_bank: string;
}): Promise<{ account_number: string; account_name: string }> {
  return fw<{ account_number: string; account_name: string }>("/accounts/resolve", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface FlutterwaveTransfer {
  id: number;
  reference: string;
  status: string; // "NEW" | "PENDING" | "SUCCESSFUL" | "FAILED"
  fee: number;
}

export async function initiateTransfer(input: {
  account_bank: string;
  account_number: string;
  amount: number;
  currency: string;
  narration: string;
  reference: string;
  beneficiary_name?: string;
  /** Mobile-money rails need the destination branch/network code. */
  destination_branch_code?: string;
  meta?: Record<string, unknown>[];
  signal?: AbortSignal;
}): Promise<FlutterwaveTransfer> {
  const { signal, ...rest } = input;
  return fw<FlutterwaveTransfer>("/transfers", {
    method: "POST",
    body: JSON.stringify(rest),
    signal,
  });
}

/**
 * Flutterwave transfer-fee estimate. We deduct this from the user's requested
 * amount so the destination account receives the net.
 */
export function estimateTransferFee(currency: string, amount: number): number {
  const cur = String(currency).toUpperCase();
  if (cur === "NGN") {
    if (amount <= 5_000) return 10.75;
    if (amount <= 50_000) return 26.88;
    return 53.75;
  }
  if (cur === "GHS") return Number(Math.min(amount * 0.01 + 1, 10).toFixed(2));
  if (cur === "KES") return 60;
  if (cur === "ZAR") return 12;
  if (cur === "UGX") return 2500;
  if (cur === "TZS") return 2000;
  if (cur === "USD") return Number(Math.max(3, amount * 0.01).toFixed(2));
  // Percentage default for the remaining local rails.
  return Number((amount * 0.015).toFixed(2));
}

/** Mobile-money rails Flutterwave exposes as pseudo "bank" codes. */
export const FW_MOMO_BANKS: Record<string, { code: string; label: string }[]> = {
  GHS: [
    { code: "MTN", label: "MTN Mobile Money" },
    { code: "VOD", label: "Telecel (Vodafone) Cash" },
    { code: "ATL", label: "AirtelTigo Money" },
  ],
  UGX: [
    { code: "MTN", label: "MTN Mobile Money" },
    { code: "AIRTEL", label: "Airtel Money" },
  ],
  TZS: [
    { code: "VODACOM", label: "M-Pesa (Vodacom)" },
    { code: "TIGO", label: "Mixx by Yas (Tigo)" },
    { code: "AIRTEL", label: "Airtel Money" },
  ],
  RWF: [{ code: "MTN", label: "MTN Mobile Money" }],
  XAF: [
    { code: "MTN", label: "MTN Mobile Money" },
    { code: "ORANGE", label: "Orange Money" },
  ],
  XOF: [
    { code: "MTN", label: "MTN Mobile Money" },
    { code: "ORANGE", label: "Orange Money" },
    { code: "MOOV", label: "Moov Money" },
  ],
  ZMW: [
    { code: "MTN", label: "MTN Mobile Money" },
    { code: "AIRTEL", label: "Airtel Money" },
  ],
};

/** ISO-2 country used for Flutterwave's bank directory, keyed by currency. */
export const FW_BANK_COUNTRY: Record<string, string> = {
  NGN: "NG",
  GHS: "GH",
  KES: "KE",
  ZAR: "ZA",
  UGX: "UG",
  TZS: "TZ",
  RWF: "RW",
  ZMW: "ZM",
  MWK: "MW",
  EGP: "EG",
  MAD: "MA",
  XOF: "CI",
  XAF: "CM",
};
