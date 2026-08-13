import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listBanksForCurrency,
  resolveBankAccount,
  createMyRecipient,
  type TransferCurrency,
} from "@/lib/payouts.functions";

export type MethodKind = "bank" | "opay" | "momo";

const MOMO_MATCH = /momo|smartcash|9payment|money master|hope|palmpay|kuda|opay/i;

export function AddMethodSheet({
  kind,
  currency,
  onClose,
  onCreated,
}: {
  kind: MethodKind;
  currency: TransferCurrency;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const banksFn = useServerFn(listBanksForCurrency);
  const resolveFn = useServerFn(resolveBankAccount);
  const createFn = useServerFn(createMyRecipient);

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<"MTN" | "Vodafone" | "AirtelTigo">("MTN");
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  const ghsMomo = kind === "momo" && currency === "GHS";

  const banksQ = useQuery({
    queryKey: ["payout-banks", currency],
    queryFn: () => banksFn({ data: { currency } }),
    enabled: !ghsMomo,
    staleTime: 60 * 60 * 1000,
  });

  const banks = useMemo(() => {
    const all = banksQ.data ?? [];
    if (kind === "opay") return all.filter((b) => /opay/i.test(b.name));
    if (kind === "momo") return all.filter((b) => MOMO_MATCH.test(b.name));
    return all;
  }, [banksQ.data, kind]);

  useEffect(() => {
    if (kind === "opay" && banks.length && !bankCode) setBankCode(banks[0].code);
  }, [kind, banks, bankCode]);

  // Auto-resolve the account name once bank + 10 digits are present.
  useEffect(() => {
    if (ghsMomo) return;
    if (!bankCode || accountNumber.length < 10) {
      setAccountName("");
      return;
    }
    let cancelled = false;
    setResolving(true);
    resolveFn({ data: { account_number: accountNumber, bank_code: bankCode } })
      .then((r) => {
        if (!cancelled) setAccountName(r.account_name);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setAccountName("");
          toast.error(e instanceof Error ? e.message : "Could not verify that account");
        }
      })
      .finally(() => !cancelled && setResolving(false));
    return () => {
      cancelled = true;
    };
  }, [bankCode, accountNumber, ghsMomo, resolveFn]);

  const title =
    kind === "bank" ? "Add Bank Account" : kind === "opay" ? "Link Your OPay Wallet" : "Add Mobile Money";

  const canSave = ghsMomo
    ? !!phone && !!accountName.trim()
    : !!bankCode && accountNumber.length >= 10 && !!accountName;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const bank = banks.find((b) => b.code === bankCode);
      const res = await createFn({
        data: ghsMomo
          ? { currency, method: "momo", momo_network: network, phone, account_name: accountName.trim() }
          : {
              currency,
              method: "bank",
              bank_code: bankCode,
              bank_name: bank?.name ?? "Bank",
              account_number: accountNumber,
              account_name: accountName,
            },
      });
      toast.success("Payout method saved");
      onCreated(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this method");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#0F0F13] border border-white/10 rounded-t-3xl sm:rounded-[10px] p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-[10px] bg-white/5 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12px] text-slate-500 -mt-2">
          You only need to do this once. We&apos;ll save it for future withdrawals.
        </p>

        {ghsMomo ? (
          <>
            <Field label="Network">
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as typeof network)}
                className="w-full bg-white/5 border border-white/10 rounded-[10px] py-3 px-3 text-white text-sm outline-none focus:border-[#E5484D]/60"
              >
                <option value="MTN">MTN Mobile Money</option>
                <option value="Vodafone">Vodafone Cash</option>
                <option value="AirtelTigo">AirtelTigo Money</option>
              </select>
            </Field>
            <Field label="Phone Number">
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="024 123 4567"
                className="w-full bg-white/5 border border-white/10 rounded-[10px] py-3 px-3 text-white text-sm outline-none focus:border-[#E5484D]/60"
              />
            </Field>
            <Field label="Account Name">
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Name on the wallet"
                className="w-full bg-white/5 border border-white/10 rounded-[10px] py-3 px-3 text-white text-sm outline-none focus:border-[#E5484D]/60"
              />
            </Field>
          </>
        ) : (
          <>
            {kind !== "opay" && (
              <Field label={kind === "momo" ? "Mobile Money Service" : "Bank"}>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-[10px] py-3 px-3 text-white text-sm outline-none focus:border-[#E5484D]/60"
                >
                  <option value="">{banksQ.isLoading ? "Loading…" : "Select"}</option>
                  {banks.map((b) => (
                    <option key={`${b.code}-${b.name}`} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={kind === "opay" ? "OPay Account / Phone Number" : "Account Number"}>
              <input
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="0123456789"
                className="w-full bg-white/5 border border-white/10 rounded-[10px] py-3 px-3 text-white text-sm outline-none focus:border-[#E5484D]/60"
              />
            </Field>
            <div className="rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 flex items-center gap-2 min-h-[46px]">
              {resolving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span className="text-xs text-slate-400">Verifying account…</span>
                </>
              ) : accountName ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">{accountName}</span>
                </>
              ) : (
                <span className="text-xs text-slate-500">Account name appears here once verified</span>
              )}
            </div>
          </>
        )}

        <button
          disabled={!canSave || saving}
          onClick={save}
          className="w-full bg-[#E5484D] disabled:opacity-40 text-white font-black py-3.5 rounded-[10px]"
        >
          {saving ? "Saving…" : "Save Method"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-widest font-bold text-slate-500">{label}</label>
      {children}
    </div>
  );
}
