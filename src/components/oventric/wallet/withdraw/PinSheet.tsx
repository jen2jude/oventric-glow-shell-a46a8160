import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock, X, Delete, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { setWithdrawalPin, verifyWithdrawalPin } from "@/lib/withdrawal-pin.functions";

type Phase = "create" | "confirm" | "verify";

export function PinSheet({
  mode,
  onClose,
  onSuccess,
}: {
  mode: "create" | "verify";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const setPinFn = useServerFn(setWithdrawalPin);
  const verifyPinFn = useServerFn(verifyWithdrawalPin);

  const [phase, setPhase] = useState<Phase>(mode === "create" ? "create" : "verify");
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  function press(d: string) {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) void submit(next);
  }

  async function submit(value: string) {
    setBusy(true);
    try {
      if (phase === "create") {
        setFirst(value);
        setPin("");
        setPhase("confirm");
        return;
      }
      if (phase === "confirm") {
        await setPinFn({ data: { pin: first, confirm: value } });
        toast.success("Withdrawal PIN created — keep it safe.");
        onSuccess();
        return;
      }
      await verifyPinFn({ data: { pin: value } });
      onSuccess();
    } catch (e) {
      setPin("");
      if (phase === "confirm") setPhase("create");
      toast.error(e instanceof Error ? e.message : "PIN error");
    } finally {
      setBusy(false);
    }
  }

  const title =
    phase === "create" ? "Create Withdrawal PIN" : phase === "confirm" ? "Confirm Your PIN" : "Enter your PIN";
  const subtitle =
    phase === "create"
      ? "Choose a 4-digit PIN. You'll use it every time you withdraw."
      : phase === "confirm"
        ? "Re-enter the same 4 digits to lock it in."
        : "Enter your 4-digit PIN to confirm this withdrawal.";

  return (
    <div className="fixed inset-0 z-[80] bg-[#0A0A0B]/95 backdrop-blur-md flex flex-col">
      <div className="flex items-center justify-between px-5 pt-[env(safe-area-inset-top)] py-4">
        <span className="text-sm font-black text-white">Security</span>
        <button onClick={onClose} className="p-2 rounded-[10px] bg-white/5 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-[10px] bg-[#E5484D]/15 border border-[#E5484D]/30 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-[#E5484D]" />
        </div>
        <h2 className="text-lg font-black text-white">{title}</h2>
        <p className="text-[13px] text-slate-400 mt-1 max-w-xs">{subtitle}</p>

        <div className="flex items-center gap-4 mt-7">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-full border transition-all ${
                i < pin.length ? "bg-[#E5484D] border-[#E5484D] scale-110" : "border-white/25"
              }`}
            />
          ))}
        </div>

        {phase !== "verify" && (
          <div className="mt-5 flex items-start gap-2 rounded-[10px] border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 max-w-xs text-left">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/90">
              Keep this PIN safe and private. Oventric staff will never ask you for it.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-8 w-full max-w-[280px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Key key={d} onClick={() => press(d)}>
              {d}
            </Key>
          ))}
          <span />
          <Key onClick={() => press("0")}>0</Key>
          <Key onClick={() => setPin((p) => p.slice(0, -1))}>
            <Delete className="w-5 h-5 mx-auto" />
          </Key>
        </div>
      </div>
    </div>
  );
}

function Key({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-14 rounded-[10px] bg-white/[0.06] border border-white/10 text-white text-xl font-black active:scale-95 transition"
    >
      {children}
    </button>
  );
}
