// Shared Flutterwave fee model — mirrors src/lib/paystack-fees.ts so the
// client-side "You'll be charged X" preview and the server-side charge always
// agree. Fees are added ON TOP of a wallet top-up so the user (not the
// platform) covers them.

export interface FlutterwaveFeeBreakdown {
  fee: number;
  charge: number;
}

export function flutterwaveFee(net: number, currency: string): FlutterwaveFeeBreakdown {
  const amount = Number(net) || 0;
  if (amount <= 0) return { fee: 0, charge: 0 };
  const cur = String(currency).toUpperCase();

  let feeRaw = 0;
  if (cur === "NGN") {
    // 1.4% local cards, capped at ₦2,000.
    feeRaw = Math.min(amount * 0.014, 2000);
  } else if (cur === "GHS") {
    feeRaw = amount * 0.0195;
  } else if (cur === "KES" || cur === "ZAR" || cur === "UGX" || cur === "TZS" || cur === "RWF") {
    feeRaw = amount * 0.029;
  } else if (cur === "USD") {
    // International cards ~3.8%.
    feeRaw = amount * 0.038;
  } else {
    // Other local African currencies ~3.0%.
    feeRaw = amount * 0.03;
  }

  const twoDp = ["USD", "ZAR", "EGP", "MAD", "ZMW", "GHS"].includes(cur);
  const round = (v: number) => (twoDp ? Number(v.toFixed(2)) : Math.ceil(v));
  const fee = round(feeRaw);
  const charge = twoDp ? Number((amount + fee).toFixed(2)) : Math.round(amount) + fee;
  return { fee, charge };
}
