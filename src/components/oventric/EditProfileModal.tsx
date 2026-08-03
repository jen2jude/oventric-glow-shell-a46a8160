import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Github, Globe, Instagram, Linkedin, Loader2, Twitter, X, Youtube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile, type SocialLinks } from "@/lib/profiles.functions";

const MAX_BIO = 280;
const MAX_NAME = 80;

type LinkKey = keyof SocialLinks;

const LINK_FIELDS: Array<{
  key: LinkKey;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
}> = [
  { key: "website", label: "Website", placeholder: "https://yoursite.com", icon: <Globe className="w-4 h-4" /> },
  { key: "x", label: "X (Twitter)", placeholder: "https://x.com/username", icon: <Twitter className="w-4 h-4" /> },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/username", icon: <Instagram className="w-4 h-4" /> },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/username", icon: <Linkedin className="w-4 h-4" /> },
  { key: "github", label: "GitHub", placeholder: "https://github.com/username", icon: <Github className="w-4 h-4" /> },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@channel", icon: <Youtube className="w-4 h-4" /> },
];

/** Accepts bare domains and @handles; returns a canonical https URL or null. */
function normaliseUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial: {
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    socialLinks: SocialLinks;
  };
  userId: string;
  onSaved: () => void | Promise<void>;
}

/**
 * Themed profile editor: avatar, display name, bio and social links.
 * Client-side validation mirrors the server's zod schema so users get
 * inline feedback before a round-trip.
 */
export function EditProfileModal({ open, onClose, initial, userId, onSaved }: Props) {
  const save = useServerFn(updateMyProfile);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [links, setLinks] = useState<Record<string, string>>(() => ({ ...initial.socialLinks }));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Reset form each time the modal opens so stale edits never leak back in.
  useEffect(() => {
    if (!open) return;
    setDisplayName(initial.displayName);
    setBio(initial.bio ?? "");
    setLinks({ ...initial.socialLinks });
    setAvatarPreview(initial.avatarUrl);
    setAvatarFile(null);
    setErrors({});
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open, initial]);

  // Lock background scroll + close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const bioLeft = MAX_BIO - bio.length;

  const pickAvatar = useCallback((file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, avatar: "Choose an image file." }));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrors((e) => ({ ...e, avatar: "Image is too large (max 8MB)." }));
      return;
    }
    setErrors((e) => ({ ...e, avatar: "" }));
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }, []);

  const initials = useMemo(
    () =>
      displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("") || "U",
    [displayName],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const next: Record<string, string> = {};
      const name = displayName.trim();
      if (name.length < 2) next.displayName = "Enter at least 2 characters.";
      if (name.length > MAX_NAME) next.displayName = `Keep it under ${MAX_NAME} characters.`;
      if (bio.length > MAX_BIO) next.bio = `Keep it under ${MAX_BIO} characters.`;

      const cleanLinks: SocialLinks = {};
      for (const f of LINK_FIELDS) {
        const raw = (links[f.key] ?? "").trim();
        if (!raw) continue;
        const url = normaliseUrl(raw);
        if (!url) next[f.key] = "Enter a valid link (e.g. https://…).";
        else cleanLinks[f.key] = url;
      }

      setErrors(next);
      if (Object.values(next).some(Boolean)) {
        toast.error("Please fix the highlighted fields.");
        return;
      }

      setSaving(true);
      try {
        let avatarPath: string | undefined;
        if (avatarFile) {
          const ext =
            (avatarFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "jpg";
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: avatarFile.type,
          });
          if (upErr) throw upErr;
          avatarPath = path;
        }

        await save({
          data: {
            displayName: name,
            bio: bio.trim() ? bio.trim() : null,
            socialLinks: cleanLinks,
            ...(avatarPath ? { avatarPath } : {}),
          },
        });

        try {
          window.dispatchEvent(new CustomEvent("oventric:profile-updated", { detail: { userId } }));
        } catch {
          /* noop */
        }
        toast.success("Profile updated");
        await onSaved();
        onClose();
      } catch (err) {
        console.error("[EditProfileModal] save failed", err);
        toast.error(err instanceof Error ? err.message : "Could not save your profile. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [displayName, bio, links, avatarFile, userId, save, onSaved, onClose],
  );

  if (!open || typeof document === "undefined") return null;

  const inputBase =
    "w-full rounded-xl bg-[#141418] md:bg-white border px-3 py-2.5 text-sm text-white md:text-slate-900 placeholder:text-slate-500 md:placeholder:text-slate-400 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 md:border-slate-200 bg-[#1a1a1f] md:bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 md:border-slate-200 bg-[#1a1a1f] md:bg-white px-4 py-3">
          <h2 id="edit-profile-title" className="text-base font-black text-white md:text-slate-900">
            Edit profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900 hover:bg-white/10 md:hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-5" noValidate>
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-emerald-500 overflow-hidden flex items-center justify-center text-black text-xl font-black">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Change profile picture"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center border-2 border-[#1a1a1f] md:border-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <Camera className="w-4 h-4" strokeWidth={2.4} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  pickAvatar(e.target.files?.[0]);
                  if (e.target) e.target.value = "";
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white md:text-slate-900">Profile picture</p>
              <p className="text-xs text-slate-400 md:text-slate-500">Square image, JPG or PNG, up to 8MB.</p>
              {errors.avatar && <p className="mt-1 text-xs font-semibold text-red-400">{errors.avatar}</p>}
            </div>
          </div>

          {/* Display name */}
          <div>
            <label htmlFor="ep-name" className="block text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500 mb-1.5">
              Display name
            </label>
            <input
              id="ep-name"
              ref={firstFieldRef}
              value={displayName}
              maxLength={MAX_NAME}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={!!errors.displayName}
              aria-describedby={errors.displayName ? "ep-name-err" : undefined}
              className={`${inputBase} ${errors.displayName ? "border-red-500/70" : "border-white/10 md:border-slate-300"}`}
              placeholder="Your name"
            />
            {errors.displayName && (
              <p id="ep-name-err" className="mt-1 text-xs font-semibold text-red-400">
                {errors.displayName}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="ep-bio" className="block text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500">
                Bio
              </label>
              <span className={`text-[11px] font-semibold ${bioLeft < 0 ? "text-red-400" : "text-slate-500"}`}>
                {bioLeft}
              </span>
            </div>
            <textarea
              id="ep-bio"
              value={bio}
              rows={3}
              maxLength={MAX_BIO + 40}
              onChange={(e) => setBio(e.target.value)}
              aria-invalid={!!errors.bio}
              className={`${inputBase} resize-none ${errors.bio ? "border-red-500/70" : "border-white/10 md:border-slate-300"}`}
              placeholder="Tell people what you do on Oventric."
            />
            {errors.bio && <p className="mt-1 text-xs font-semibold text-red-400">{errors.bio}</p>}
          </div>

          {/* Social links */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500">Social links</p>
            {LINK_FIELDS.map((f) => (
              <div key={f.key}>
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 bg-[#141418] md:bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/30 transition-colors ${
                    errors[f.key] ? "border-red-500/70" : "border-white/10 md:border-slate-300"
                  }`}
                >
                  <span className="text-slate-400 md:text-slate-500 shrink-0" aria-hidden>
                    {f.icon}
                  </span>
                  <input
                    aria-label={f.label}
                    value={links[f.key] ?? ""}
                    onChange={(e) => setLinks((l) => ({ ...l, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    inputMode="url"
                    className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-white md:text-slate-900 placeholder:text-slate-500 md:placeholder:text-slate-400 outline-none"
                  />
                </div>
                {errors[f.key] && <p className="mt-1 text-xs font-semibold text-red-400">{errors[f.key]}</p>}
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-[#1a1a1f] md:bg-white border-t border-white/10 md:border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 md:text-slate-600 hover:bg-white/10 md:hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
