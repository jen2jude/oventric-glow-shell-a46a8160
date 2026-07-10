import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, ShieldCheck, LogOut, Settings, UserCircle2, X, Upload, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { getProfileByIdOrSlug, updateMyProfile } from "@/lib/profiles.functions";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };



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
  const [isMobile, setIsMobile] = useState(false);
  const [userId, setUserId] = useState<string>("me");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef(false);
  const triggerId = "profile-dropdown-trigger";
  const menuId = "profile-dropdown-menu";
  const navigate = useNavigate();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639.98px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);


  const { tier, balances, balancesHidden, toggleBalancesHidden, fullName, storeName, baseCurrency, setBaseCurrency } = useOnboarding();

  const [profile, setProfile] = useState<ProfileState>(() => loadProfile(fullName || storeName || "Sovereign Architect"));

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const id = data.session?.user?.id;
      if (id) setUserId(id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    // Sync default display name once fullName arrives from onboarding
    setProfile((p) => (p.displayName ? p : { ...p, displayName: fullName || storeName || "Sovereign Architect" }));
  }, [fullName, storeName]);

  // Load the real profile row (name, bio, avatar signed URL) once we know
  // this session's user id.
  const fetchRealProfile = useServerFn(getProfileByIdOrSlug);
  useEffect(() => {
    if (!userId || userId === "me") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchRealProfile({ data: { idOrSlug: userId } });
        if (cancelled || !res.profile) return;
        setProfile((p) => ({
          displayName: res.profile!.displayName || p.displayName,
          bio: res.profile!.bio ?? p.bio,
          avatarDataUrl: res.profile!.avatarUrl ?? p.avatarDataUrl,
        }));
      } catch (e) {
        console.error("[ProfileDropdown] real profile load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, fetchRealProfile]);


  const getMenuItems = (): HTMLElement[] => {
    if (!menuRef.current) return [];
    return Array.from(
      menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    );
  };

  const closeMenu = (returnFocus = true) => {
    returnFocusRef.current = returnFocus;
    setOpen(false);
  };

  // Return focus to trigger after close
  useEffect(() => {
    if (open) return;
    if (returnFocusRef.current) {
      triggerRef.current?.focus();
      returnFocusRef.current = false;
    }
  }, [open]);

  // Focus first menu item on open
  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => {
      const items = getMenuItems();
      items[0]?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu(true);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Trap Tab focus inside the panel while open. Return-to-trigger is handled
  // by the effect above, so we opt out of the hook's own restore.
  useFocusTrap(menuRef, open, { restoreFocus: false });

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = getMenuItems();
    if (items.length === 0) return;
    const currentIdx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[(currentIdx + 1 + items.length) % items.length];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[(currentIdx - 1 + items.length) % items.length];
      prev?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
    // Tab is intentionally not handled here — focus is trapped inside the
    // panel by useFocusTrap so keyboard users can't accidentally leave the
    // open menu without dismissing it (Esc / outside click).
  };

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
    closeMenu(false);
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
    closeMenu(false);
    setSettingsOpen(true);
  };

  const avatarBtn = (
    <button
      ref={triggerRef}
      id={triggerId}
      type="button"
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setOpen(true);
        }
      }}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      aria-label="Open profile menu"
      className="rgb-pulse-glow relative w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-bold text-sm overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121214]"
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
          role="menuitem"
          tabIndex={-1}
          onClick={toggleBalancesHidden}
          className="text-slate-500 hover:text-slate-300 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus:text-slate-200"
          aria-label={balancesHidden ? "Show balances" : "Hide balances"}
        >
          {balancesHidden ? <EyeOff className="w-3 h-3" aria-hidden /> : <Eye className="w-3 h-3" aria-hidden />}
          {balancesHidden ? "Hidden" : "Visible"}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Base currency">
        {(["USD", "NGN", "GHS"] as Currency[]).map((c) => {
          const active = baseCurrency === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setBaseCurrency(c)}
              className={`rounded-lg px-2 py-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                active
                  ? "bg-emerald-500/15 border border-emerald-400/60 shadow-[0_0_12px_-4px_rgba(16,185,129,0.9)]"
                  : "bg-[#121214] border border-white/5 hover:border-white/20"
              }`}
              title={active ? `${c} is your active currency` : `Switch prices to ${c}`}
            >
              <div className={`text-[9px] font-bold uppercase tracking-widest ${active ? "text-emerald-300" : "text-slate-500"}`}>{c}{active ? " · Active" : ""}</div>
              <div className={`text-xs font-black tabular-nums mt-0.5 ${balancesHidden ? "text-slate-600" : active ? "text-emerald-100" : "text-white"}`}>
                {balancesHidden ? "••••••" : `${CURRENCY_SYMBOL[c]}${fmtBalance(balances[c], c)}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const navMatrix = (
    <div className="space-y-1" role="none">
      <Link
        to="/profile/$id"
        params={{ id: userId }}
        role="menuitem"
        tabIndex={-1}
        onClick={() => closeMenu(false)}
        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus:bg-white/5 focus:text-white"
      >
        <UserCircle2 className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden />
        <div className="min-w-0">
          <div className="font-semibold truncate">View Public Profile Workspace</div>
          <div className="text-[10px] text-slate-500 truncate">Your /profile aggregator tab view</div>
        </div>
      </Link>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={openSettings}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus:bg-white/5 focus:text-white"
      >
        <Settings className="w-4 h-4 text-sky-300 shrink-0" aria-hidden />
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
      role="menuitem"
      tabIndex={-1}
      onClick={onSignOut}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-bold text-red-300 bg-red-500/5 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
    >
      <LogOut className="w-4 h-4 shrink-0" aria-hidden />
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

  const mobilePanel =
    open && isMobile && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              aria-hidden
              onClick={() => closeMenu(true)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            />
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              tabIndex={-1}
              aria-labelledby={triggerId}
              aria-orientation="vertical"
              aria-modal="true"
              onKeyDown={onMenuKeyDown}
              className="fixed bottom-0 left-0 right-0 w-full rounded-t-2xl border-t border-x border-white/5 bg-[#1E1E24] p-6 pb-8 z-[100] max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200 focus:outline-none"
            >
              <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4" aria-hidden />
              {panelBody}
            </div>
          </>,
          document.body,
        )
      : null;

  const desktopPanel =
    open && !isMobile ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        tabIndex={-1}
        aria-labelledby={triggerId}
        aria-orientation="vertical"
        onKeyDown={onMenuKeyDown}
        className="absolute top-14 right-0 w-72 rounded-xl border border-white/5 bg-[#1E1E24] p-4 z-[100] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 focus:outline-none"
      >
        {panelBody}
      </div>
    ) : null;

  return (
    <div ref={wrapperRef} className="relative">
      {avatarBtn}
      {desktopPanel}
      {mobilePanel}

      <ProfileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        userId={userId}
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(dialogRef, open, { initialFocus: closeBtnRef });

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={saving ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#1A1A1E] border border-emerald-500/30 rounded-2xl shadow-2xl my-auto max-h-[90vh] flex flex-col focus:outline-none"
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-white/5">
          <div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/40 text-emerald-300 mb-1.5">
              <Settings className="w-3 h-3" aria-hidden /> Profile Settings
            </div>
            <h2 id={titleId} className="text-white font-black text-base">Identity & KYC</h2>
            <p id={descId} className="text-[11px] text-slate-500 mt-0.5">Update your display name, bio, avatar, and verification docs.</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 hover:text-white p-1 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
            aria-label="Close profile settings"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>

        <form onSubmit={onSubmit} noValidate className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 scrollbar-thin">
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
              <div className="rounded-lg border border-dashed border-white/15 hover:border-emerald-500/50 bg-[#121214] px-3 py-3 text-center transition-colors focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/70 focus-within:ring-offset-2 focus-within:ring-offset-[#1A1A1E]">
                <Upload className="w-4 h-4 text-slate-400 mx-auto mb-1" aria-hidden />
                <div className="text-[11px] font-semibold text-slate-300">Upload avatar</div>
                <div className="text-[10px] text-slate-500">PNG · JPG · WebP · max 2MB</div>
              </div>
              <input
                type="file"
                accept="image/*"
                aria-label="Upload avatar image"
                className="sr-only"
                onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div>
            <label htmlFor={`${titleId}-name`} className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Display Name</label>
            <input
              id={`${titleId}-name`}
              className={`w-full bg-[#121214] border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E] ${
                errors.displayName ? "border-red-500/60" : "border-white/10 focus:border-emerald-500/60"
              }`}
              value={displayName}
              maxLength={40}
              onChange={(e) => { setDisplayName(e.target.value); setErrors((p) => ({ ...p, displayName: "" })); }}
              aria-invalid={!!errors.displayName}
              aria-describedby={errors.displayName ? `${titleId}-name-err` : undefined}
            />
            {errors.displayName && <p id={`${titleId}-name-err`} className="text-[11px] font-semibold text-red-400 mt-1">{errors.displayName}</p>}
          </div>

          <div>
            <label htmlFor={`${titleId}-bio`} className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Developer Bio</label>
            <textarea
              id={`${titleId}-bio`}
              rows={3}
              className={`w-full bg-[#121214] border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E] ${
                errors.bio ? "border-red-500/60" : "border-white/10 focus:border-emerald-500/60"
              }`}
              value={bio}
              maxLength={280}
              onChange={(e) => { setBio(e.target.value); setErrors((p) => ({ ...p, bio: "" })); }}
              placeholder="Payments infra, distributed systems, RLS zealot…"
              aria-invalid={!!errors.bio}
              aria-describedby={errors.bio ? `${titleId}-bio-err` : undefined}
            />
            <div className="flex justify-between mt-1">
              {errors.bio ? (
                <p id={`${titleId}-bio-err`} className="text-[11px] font-semibold text-red-400">{errors.bio}</p>
              ) : (
                <span className="text-[10px] text-slate-500">Displayed on your public workspace.</span>
              )}
              <span className="text-[10px] text-slate-500 tabular-nums" aria-live="polite">{bio.length}/280</span>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#121214] p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden />
              <span className="text-xs font-bold text-white">Pending verification docs</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Upload updated ID or utility bill to raise your verification tier.</p>
            <button
              type="button"
              onClick={() => toast("KYC uploader launching soon", { description: "Verification desk is queued for release next sprint." })}
              className="w-full text-xs font-bold py-2 rounded-lg bg-[#1E1E24] border border-white/10 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E]"
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
            className="px-4 py-2 rounded-lg bg-[#121214] border border-white/10 text-slate-300 text-xs font-bold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit as unknown as () => void}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E]"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

