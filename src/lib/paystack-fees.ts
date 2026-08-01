// Shared Paystack fee model — kept in one place so the client-side "You'll be
// charged X" preview and the server-side initialize call always agree.
//
// Rates reflect Paystack's public pricing at the time of writing. We add the
// fee ON TOP of the user's requested top-up so the wallet is credited with the
// exact amount they entered while Paystack still receives its cut from the
// user (not from the platform).

export type PaystackFeeCurrency = string;

export interface PaystackFeeBreakdown {
  fee: number;   // rounded to currency precision
  charge: number; // net + fee, rounded to currency precision
}

export function paystackFee(net: number, currency: PaystackFeeCurrency): PaystackFeeBreakdown {
  const amount = Number(net) || 0;
  if (amount <= 0) return { fee: 0, charge: 0 };

  let feeRaw = 0;
  if (currency === "NGN") {
    // 1.5% + ₦100 flat (flat waived under ₦2,500), capped at ₦2,000.
    feeRaw = amount * 0.015 + (amount >= 2500 ? 100 : 0);
    if (feeRaw > 2000) feeRaw = 2000;
  } else if (currency === "GHS") {
    // 1.95% local card fee.
    feeRaw = amount * 0.0195;
  } else {
    // USD: international card ~3.9% + $0.30.
    feeRaw = amount * 0.039 + 0.3;
  }

  const round = (v: number) => (currency === "USD" ? Number(v.toFixed(2)) : Math.ceil(v));
  const fee = round(feeRaw);
  const charge = currency === "USD" ? Number((amount + fee).toFixed(2)) : Math.round(amount) + fee;
  return { fee, charge };
}
