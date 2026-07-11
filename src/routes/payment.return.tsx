import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { verifyPaystackPayment } from "@/lib/paystack.functions";

export const Route = createFileRoute("/payment/return")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    reference: typeof s?.reference === "string" ? s.reference : (typeof s?.trxref === "string" ? s.trxref : ""),
  }),
  component: PaymentReturnPage,
});

function PaymentReturnPage() {
  const { reference } = Route.useSearch();
  const verify = useServerFn(verifyPaystackPayment);
  const navigate = useNavigate();
  const [state, setState] = useState<"verifying" | "ok" | "failed">("verifying");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!reference) { setState("failed"); setMsg("Missing payment reference"); return; }
    verify({ data: { reference } })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setState("ok");
          setTimeout(() => { navigate({ to: r.redirectTo ?? "/", replace: true }); }, 900);
        } else {
          setState("failed");
          setMsg(`Payment ${r.status}`);
        }
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setState("failed");
        setMsg(e.message || "Verification failed");
      });
    return () => { cancelled = true; };
  }, [reference, verify, navigate]);

  return (
    <div className="min-h-screen bg-[#121214] text-slate-200">
      <Header onOpenMessages={() => {}} />
      <main className="max-w-md mx-auto w-full px-4 py-24 text-center">
        {state === "verifying" && (
          <>
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-black text-white mb-1">Confirming your payment…</h1>
            <p className="text-xs text-slate-500 font-mono">{reference}</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-lg font-black text-white mb-1">Payment confirmed</h1>
            <p className="text-sm text-slate-400">Redirecting…</p>
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h1 className="text-lg font-black text-white mb-1">Payment not completed</h1>
            <p className="text-sm text-slate-400 mb-4">{msg || "You can try again from the checkout."}</p>
            <button
              onClick={() => navigate({ to: "/", replace: true })}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold"
            >
              Back to Home
            </button>
          </>
        )}
      </main>
    </div>
  );
}
