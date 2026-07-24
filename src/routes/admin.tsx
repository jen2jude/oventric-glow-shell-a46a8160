import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Package,
  Megaphone,
  Tags,
  ToggleLeft,
  ScrollText,
  Settings,
  LogOut,
  AlertCircle,
  Loader2,
  Radio,
  Target,
  Wallet,
  GraduationCap,
  Banknote,
  BookOpen,
} from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console · Oventric" },
      { name: "description", content: "Internal admin CRM." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
  errorComponent: AdminError,
  notFoundComponent: () => <div className="p-6 text-slate-300">Not found.</div>,
});

function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#0b0b0d] text-slate-200 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Admin error</h2>
        <p className="text-sm text-slate-400 mt-1">{error.message}</p>
        <button
          onClick={() => { reset(); router.invalidate(); }}
          className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/admin/ad-inquiries", label: "Ad Inquiries", icon: Megaphone },
  { to: "/admin/bounties", label: "Bounties", icon: Target },
  { to: "/admin/courses", label: "Academy", icon: GraduationCap },
  { to: "/admin/blog", label: "Blog", icon: BookOpen },
  { to: "/admin/system-wallets", label: "System Wallets", icon: Wallet },
  { to: "/admin/payouts", label: "Payouts", icon: Banknote },
  { to: "/admin/affiliates", label: "Affiliates", icon: Users },


  { to: "/admin/communications", label: "Communications", icon: Radio },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/features", label: "Features", icon: ToggleLeft },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/reports", label: "Reports", icon: ShieldCheck },
];

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const router = useRouter();
  const [state, setState] = useState<"loading" | "unauth" | "forbidden" | "ok">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { if (!cancelled) setState("unauth"); return; }
      try {
        const res = await check();
        if (cancelled) return;
        setState(res.isAdmin ? "ok" : "forbidden");
      } catch {
        if (!cancelled) setState("forbidden");
      }
    })();
    return () => { cancelled = true; };
  }, [check]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (state === "unauth" || state === "forbidden") {
    return (
      <div className="min-h-screen bg-[#0b0b0d] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#141418] border border-white/10 rounded-2xl p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-black text-white">Admin Console</h1>
          <p className="text-sm text-slate-400 mt-2">
            {state === "unauth"
              ? "Sign in with an administrator account to continue."
              : "Your account does not have administrator access."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {state === "unauth" ? (
              <button
                onClick={async () => {
                  const email = window.prompt("Admin email:");
                  if (!email) return;
                  const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: window.location.href },
                  });
                  if (error) alert(error.message);
                  else alert("Magic link sent. Check your inbox.");
                }}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg"
              >
                Send admin magic link
              </button>
            ) : (
              <button
                onClick={async () => { await supabase.auth.signOut(); router.invalidate(); }}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold rounded-lg"
              >
                Sign out
              </button>
            )}
            <Link
              to="/"
              className="text-xs text-slate-500 hover:text-slate-300 mt-2"
            >
              Back to site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-slate-200 flex">
      <aside className="w-60 shrink-0 bg-[#141418] border-r border-white/10 flex flex-col">
        <div className="px-4 py-5 border-b border-white/10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <div className="text-white text-sm font-black leading-tight">Admin CRM</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Oventric</div>
          </div>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              activeProps={{ className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" }}
              inactiveProps={{ className: "text-slate-400 hover:text-white hover:bg-white/5 border-transparent" }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
            >
              <n.icon className="w-4 h-4 shrink-0" />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.invalidate(); }}
          className="m-2 flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 text-sm"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
