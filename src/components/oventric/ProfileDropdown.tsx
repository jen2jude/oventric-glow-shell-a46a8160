import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Star, ShieldCheck, LogOut, Settings, UserCircle2, X, Upload, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatch(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return match;
}

function slugify(v: string): string {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "architect";
}

function fmtBalance(n: number, c: Currency): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: c === "NGN" ? 0 : 2,
    maximumFractionDigits: c === "NGN" ? 0 : 2,
  }).format(n);
}

interface ProfileState {
  displayName: string;
  bio: string;
  avatarDataUrl: string | null;
}

const PROFILE_KEY = "oventric.profile";

function loadProfile(fallbackName: string): ProfileState {
  if (typeof window === "undefined") return { displayName: fallbackName, bio: "", avatarDataUrl: null };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) return { displayName: fallbackName, bio: "", avatarDataUrl: null, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { displayName: fallbackName, bio: "", avatarDataUrl: null };
}

export function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("me");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const navigate = useNavigate();

  const { tier, balances, balancesHidden, toggleBalancesHidden, fullName, storeName } = useOnboarding();

  const [profile, setProfile] = useState<ProfileState>(() => loadProfile(fullName || storeName || "Sovereign Architect"));

  useEffect(() => {
    // Sync default display name once fullName arrives from onboarding
    setProfile((p) => (p.displayName ? p : { ...p, displayName: fullName || storeName || "Sovereign Architect" }));
  }, [fullName, storeName]);

  useEffect(() => {
    if (open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    // no-op when closed
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const persistProfile = (next: ProfileState) => {
    setProfile(next);
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "OV";

  const handle = "@" + slugify(profile.displayName);

  const tierLabel = tier === 0 ? "Unverified" : `Tier ${tier} Verified`;
  const reputation = (4.2 + Math.min(tier, 5) * 0.12).toFixed(2);

  const onSignOut = async () => {
    setOpen(false);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out", { description: "Session tokens cleared. Returning to the auth gateway." });
      navigate({ to: "/" });
    } catch (err) {
      toast.error("Sign-out failed", { description: err instanceof Error ? err.message : "Could not clear session. Try again." });
    }
  };

  const openSettings = () => {
    setOpen(false);
    setSettingsOpen(true);
  };

  const avatarBtn = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="Open profile menu"
      className="rgb-pulse-glow relative w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-bold text-sm overflow-hidden"
    >
      {profile.avatarDataUrl ? (
        <img src={profile.avatarDataUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#121214] bg-emerald-400" aria-hidden />
    </button>
  );

  const identityBanner = (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-black font-black text-base flex items-center justify-center shrink-0 overflow-hidden">
        {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" className="w-full h-full object-cover" /> : initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white font-black text-sm truncate">{profile.displayName}</div>
        <div className="text-[11px] text-slate-500 font-mono truncate">{handle}</div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            tier > 0
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-slate-500/15 border-slate-500/40 text-slate-300"
          }`}>
            <ShieldCheck className="w-3 h-3" /> {tierLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
            <Star className="w-3 h-3 fill-amber-300" /> {reputation}
          </span>
        </div>
      </div>
    </div>
  );

  const walletSnapshot = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Wallet Snapshot</span>
        <button
          type="button"
          onClick={toggleBalancesHidden}
          className="text-slate-500 hover:text-slate-300 inline-flex items-center gap-1 text-[10px] font-semibold"
          aria-label={balancesHidden ? "Show balances" : "Hide balances"}
        >
          {balancesHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {balancesHidden ? "Hidden" : "Visible"}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["USD", "NGN", "GHS"] as Currency[]).map((c) => (
          <div key={c} className="rounded-lg bg-[#121214] border border-white/5 px-2 py-2 text-center">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{c}</div>
            <div className={`text-xs font-black tabular-nums mt-0.5 ${balancesHidden ? "text-slate-600" : "text-white"}`}>
              {balancesHidden ? "••••••" : `${CURRENCY_SYMBOL[c]}${fmtBalance(balances[c], c)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const navMatrix = (
    <div className="space-y-1">
      <Link
        to="/profile/$id"
        params={{ id: userId }}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors"
      >
        <UserCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold truncate">View Public Profile Workspace</div>
          <div className="text-[10px] text-slate-500 truncate">Your /profile aggregator tab view</div>
        </div>
      </Link>
      <button
        type="button"
        onClick={openSettings}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left"
      >
        <Settings className="w-4 h-4 text-sky-300 shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold truncate">Profile Settings & KYC Edit</div>
          <div className="text-[10px] text-slate-500 truncate">Name, bio, avatar, verification docs</div>
        </div>
      </button>
    </div>
  );

  const signOutRow = (
    <button
      type="button"
      onClick={onSignOut}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-bold text-red-300 bg-red-500/5 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/40 transition-colors"
    >
      <LogOut className="w-4 h-4 shrink-0" />
      Exit Platform / Sign Out
    </button>
  );

  const panelBody = (
    <div className="space-y-4">
      <div className="pb-4 border-b border-white/5">{identityBanner}</div>
      <div className="pb-4 border-b border-white/5">{walletSnapshot}</div>
      <div className="pb-4 border-b border-white/5">{navMatrix}</div>
      <div>{signOutRow}</div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative">
      {avatarBtn}

      {/* Desktop dropdown */}
      {open && !isMobile && (
        <div
          role="menu"
          className="bg-[#1E1E24] border border-white/5 rounded-xl shadow-2xl p-4 w-72 absolute right-0 top-14 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {panelBody}
        </div>
      )}

      {/* Mobile bottom sheet */}
      {open && isMobile && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="menu"
            className="absolute inset-x-0 bottom-0 bg-[#1E1E24] border-t border-white/10 rounded-t-2xl shadow-2xl p-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4" aria-hidden />
            {panelBody}
          </div>
        </div>
      )}

      <ProfileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        onSave={persistProfile}
      />
    </div>
  );
}

// ============================================================================
// Settings modal
// ============================================================================

function ProfileSettingsModal({
  open,
  onClose,
  profile,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  profile: ProfileState;
  onSave: (next: ProfileState) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState<string | null>(profile.avatarDataUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.displayName);
    setBio(profile.bio);
    setAvatar(profile.avatarDataUrl);
    setErrors({});
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const onAvatarPick = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file", { description: "Pick a PNG, JPG, or WebP image." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large", { description: "Keep avatars under 2 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = "Display name is required.";
    else if (displayName.trim().length > 40) e.displayName = "Keep under 40 characters.";
    if (bio.length > 280) e.bio = "Bio must be under 280 characters.";
    return e;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Fix the highlighted fields");
      return;
    }
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 350));
      onSave({ displayName: displayName.trim(), bio: bio.trim(), avatarDataUrl: avatar });
      toast.success("Profile updated", { description: "Your workspace identity is synced." });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[#1A1A1E] border border-emerald-500/30 rounded-2xl shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-white/5">
          <div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/40 text-emerald-300 mb-1.5">
              <Settings className="w-3 h-3" /> Profile Settings
            </div>
            <h2 className="text-white font-black text-base">Identity & KYC</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Update your display name, bio, avatar, and verification docs.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-slate-400 hover:text-white p-1 disabled:opacity-50" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={onSubmit} noValidate className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 overflow-hidden shrink-0">
              {avatar ? (
                <img src={avatar} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-black font-black">
                  {displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "OV"}
                </div>
              )}
            </div>
            <label className="flex-1 cursor-pointer">
              <div className="rounded-lg border border-dashed border-white/15 hover:border-emerald-500/50 bg-[#121214] px-3 py-3 text-center transition-colors">
                <Upload className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                <div className="text-[11px] font-semibold text-slate-300">Upload avatar</div>
                <div className="text-[10px] text-slate-500">PNG · JPG · WebP · max 2MB</div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Display Name</label>
            <input
              className={`w-full bg-[#121214] border rounded-lg px-3 py-2 text-sm text-white focus:outline-none ${
                errors.displayName ? "border-red-500/60" : "border-white/10 focus:border-emerald-500/60"
              }`}
              value={displayName}
              maxLength={40}
              onChange={(e) => { setDisplayName(e.target.value); setErrors((p) => ({ ...p, displayName: "" })); }}
              aria-invalid={!!errors.displayName}
            />
            {errors.displayName && <p className="text-[11px] font-semibold text-red-400 mt-1">{errors.displayName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Developer Bio</label>
            <textarea
              rows={3}
              className={`w-full bg-[#121214] border rounded-lg px-3 py-2 text-sm text-white focus:outline-none ${
                errors.bio ? "border-red-500/60" : "border-white/10 focus:border-emerald-500/60"
              }`}
              value={bio}
              maxLength={280}
              onChange={(e) => { setBio(e.target.value); setErrors((p) => ({ ...p, bio: "" })); }}
              placeholder="Payments infra, distributed systems, RLS zealot…"
              aria-invalid={!!errors.bio}
            />
            <div className="flex justify-between mt-1">
              {errors.bio ? (
                <p className="text-[11px] font-semibold text-red-400">{errors.bio}</p>
              ) : (
                <span className="text-[10px] text-slate-500">Displayed on your public workspace.</span>
              )}
              <span className="text-[10px] text-slate-500 tabular-nums">{bio.length}/280</span>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#121214] p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Pending verification docs</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Upload updated ID or utility bill to raise your verification tier.</p>
            <button
              type="button"
              onClick={() => toast("KYC uploader launching soon", { description: "Verification desk is queued for release next sprint." })}
              className="w-full text-xs font-bold py-2 rounded-lg bg-[#1E1E24] border border-white/10 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
            >
              Process pending verification →
            </button>
          </div>
        </form>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#121214] border border-white/10 text-slate-300 text-xs font-bold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit as unknown as () => void}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
