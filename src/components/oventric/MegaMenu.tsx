import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  X, Sun, Moon, MessageCircle, Shield, Users, Image as ImageIcon,
  ShoppingBag, Target, Wallet as WalletIcon, GraduationCap,
  ChevronDown, Settings, HelpCircle, Info, FileText, Lock,
  Bug, ListChecks, Trash2, Gift, LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { toast } from "sonner";

const INVITE_AMOUNTS: Record<string, { amount: number; symbol: string; label: string }> = {
  NGN: { amount: 1000, symbol: "₦", label: "₦1,000" },
  GHS: { amount: 20, symbol: "₵", label: "₵20" },
  USD: { amount: 2, symbol: "$", label: "$2" },
};

import { DeleteAccountModal } from "@/components/oventric/DeleteAccountModal";

interface Props { open: boolean; onClose: () => void; }

export function MegaMenu({ open, onClose }: Props) {
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [dangerExpanded, setDangerExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { isAuthenticated, openGate } = useAuthGate();
  const { fullName, storeName, baseCurrency } = useOnboarding();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userSlug, setUserSlug] = useState<string>("me");


  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("slug, avatar_path")
        .eq("user_id", uid)
        .maybeSingle();
      if (prof?.slug) setUserSlug(prof.slug);
      if (prof?.avatar_path) {
        const { data: signed } = await supabase.storage
          .from("avatars").createSignedUrl(prof.avatar_path, 3600);
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const invite = INVITE_AMOUNTS[baseCurrency] ?? INVITE_AMOUNTS.USD;
  const displayName = fullName || storeName || "Guest";

  const go = (path: string, section?: string) => {
    onClose();
    if (section) {
      navigate({ to: "/" });
      setTimeout(() => window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } })), 30);
    } else {
      navigate({ to: path as string });
    }
  };

  const goFollowers = () => {
    onClose();
    if (userSlug && userSlug !== "me") {
      navigate({ to: "/profile/$id", params: { id: userSlug } });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  const openMessages = () => {
    onClose();
    window.dispatchEvent(new CustomEvent("oventric:open-messages"));
  };

  const grid = [
    { icon: MessageCircle, label: "Messages", onClick: openMessages },
    { icon: Shield, label: "Circles & Guilds", onClick: () => go("/", "Circles") },
    { icon: Users, label: "Followers", onClick: goFollowers },
    { icon: ImageIcon, label: "Gallery", onClick: () => go("/dashboard") },
    { icon: ShoppingBag, label: "Marketplace", onClick: () => go("/", "Marketplace") },
    { icon: Target, label: "Bounties", onClick: () => go("/", "Bounties") },
    { icon: WalletIcon, label: "My Wallet", onClick: () => go("/", "Wallet") },
    { icon: GraduationCap, label: "Academy", onClick: () => go("/", "Academy") },
  ];

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/?ref=${userSlug}` : "";

  const doInvite = async () => {
    if (!isAuthenticated) { openGate("generic"); return; }
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join me on Oventric", text: `Earn ${invite.label} when you join Oventric.`, url: inviteLink });
      } else {
        await navigator.clipboard.writeText(inviteLink);
        toast.success("Invite link copied");
      }
    } catch { /* user cancelled */ }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    onClose();
    navigate({ to: "/" });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[70] bg-[#0b0b0d] text-slate-200 overflow-y-auto"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-[#0b0b0d]/95 backdrop-blur-md border-b border-white/10">
        <span className="text-sm font-bold text-white">Menu</span>
        <button onClick={onClose} aria-label="Close menu" className="p-2 rounded-lg hover:bg-white/5">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-16">
        {/* User header + theme toggle */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#141418] border border-white/10">
          <button
            onClick={() => { if (userSlug && userSlug !== "me") { onClose(); navigate({ to: "/profile/$id", params: { id: userSlug } }); } }}
            className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-[#1E1E24] border border-white/10 grid place-items-center text-sm font-bold text-emerald-300"
            aria-label="Open my profile"
          >
            <AvatarImage src={avatarUrl} alt={displayName} initials={(displayName[0] ?? "?").toUpperCase()} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{isAuthenticated ? displayName : "Guest"}</p>
            <p className="text-xs text-slate-500 truncate">
              {isAuthenticated ? "View your profile" : "Sign in to unlock"}
            </p>
          </div>
          <button
            onClick={toggle}
            aria-label="Toggle color theme"
            className="shrink-0 w-11 h-11 grid place-items-center rounded-full bg-[#1E1E24] border border-white/10 hover:border-emerald-400/50"
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-slate-300" />}
          </button>
        </div>

        {/* Invite friends */}
        <button
          onClick={doInvite}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30 hover:border-emerald-400/60 transition-colors text-left"
        >
          <span className="w-11 h-11 grid place-items-center rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">
            <Gift className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-white">Invite friends</span>
            <span className="block text-xs text-emerald-200/80">Earn {invite.label} for every user you invite</span>
          </span>
        </button>

        {/* 2-col grid */}
        <div className="grid grid-cols-2 gap-2">
          {grid.map((g) => (
            <button
              key={g.label}
              onClick={g.onClick}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#141418] border border-white/10 hover:border-emerald-400/40 transition-colors text-left"
            >
              <span className="w-9 h-9 grid place-items-center rounded-full bg-[#1E1E24] text-emerald-300 shrink-0">
                <g.icon className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-white truncate">{g.label}</span>
            </button>
          ))}
        </div>

        {/* Settings & Privacy */}
        <div className="rounded-2xl bg-[#141418] border border-white/10 overflow-hidden">
          <button
            onClick={() => setSettingsExpanded((v) => !v)}
            className="w-full flex items-center gap-3 p-4 text-left"
            aria-expanded={settingsExpanded}
          >
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="flex-1 text-sm font-bold text-white">Settings &amp; Privacy</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${settingsExpanded ? "rotate-180" : ""}`} />
          </button>
          {settingsExpanded && (
            <div className="border-t border-white/10 divide-y divide-white/5">
              <SubItem icon={Settings} label="Settings (Profile & KYC)" onClick={() => go("/dashboard")} />
              <SubItem icon={HelpCircle} label="Help" onClick={() => go("/help")} />
              <SubItem icon={Info} label="About Oventric" onClick={() => go("/about")} />
              <SubItem icon={FileText} label="Terms of Use" onClick={() => go("/terms")} />
              <SubItem icon={Lock} label="Privacy Policy" onClick={() => go("/privacy")} />
              <SubItem icon={Bug} label="Report a problem" onClick={() => go("/report-problem")} />
              <SubItem icon={ListChecks} label="FAQ" onClick={() => go("/faq")} />
            </div>
          )}
        </div>

        {/* Danger zone */}
        {isAuthenticated && (
          <div className="rounded-2xl bg-[#1a1010] border border-red-500/30 overflow-hidden">
            <button
              onClick={() => setDangerExpanded((v) => !v)}
              className="w-full flex items-center gap-3 p-4 text-left"
              aria-expanded={dangerExpanded}
            >
              <Trash2 className="w-5 h-5 text-red-400" />
              <span className="flex-1 text-sm font-bold text-red-200">Danger zone</span>
              <ChevronDown className={`w-4 h-4 text-red-300 transition-transform ${dangerExpanded ? "rotate-180" : ""}`} />
            </button>
            {dangerExpanded && (
              <div className="border-t border-red-500/20 p-4 text-xs text-red-200/90 space-y-3">
                <p>
                  Deleting your account starts a 30-day soft-deletion window. Sign in during that
                  period to reactivate (face liveness required). After 30 days, all data is
                  permanently removed.
                </p>
                <button
                  onClick={() => { setDeleteOpen(true); }}
                  className="w-full h-10 rounded-full bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold hover:bg-red-500/30"
                >
                  Delete my account
                </button>

              </div>
            )}
          </div>
        )}

        {isAuthenticated && (
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-[#141418] border border-white/10 text-slate-300 text-sm font-semibold hover:border-red-400/40 hover:text-red-200"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        )}
      </div>
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => { setDeleteOpen(false); onClose(); navigate({ to: "/" }); }}
      />
    </div>
  );
}


function SubItem({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="text-sm text-slate-200">{label}</span>
    </button>
  );
}
