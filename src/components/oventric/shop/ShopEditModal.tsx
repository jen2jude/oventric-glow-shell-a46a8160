import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateMyShop, type ShopBranding } from "@/lib/shop.functions";

const ACCENT = "#E5484D";

/**
 * Owner-only editor for the seller shop surface: shop name, logo, cover and
 * about copy. Deliberately separate from the personal profile editor.
 */
export function ShopEditModal({
  open,
  onClose,
  shop,
  userId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  shop: ShopBranding;
  userId: string;
  onSaved: () => void;
}) {
  const save = useServerFn(updateMyShop);
  const [name, setName] = useState(shop.shopName);
  const [about, setAbout] = useState(shop.shopAbout ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(shop.logoUrl);
  const [coverPreview, setCoverPreview] = useState<string | null>(shop.coverUrl);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File, bucket: "avatars" | "profile-covers") => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/shop-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      return path;
    },
    [userId],
  );

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (name.trim().length < 2) {
        toast.error("Shop name needs at least 2 characters.");
        return;
      }
      setSaving(true);
      try {
        const [logoPath, coverPath] = await Promise.all([
          logoFile ? upload(logoFile, "avatars") : Promise.resolve(undefined),
          coverFile ? upload(coverFile, "profile-covers") : Promise.resolve(undefined),
        ]);
        await save({
          data: {
            shopName: name.trim(),
            shopAbout: about.trim(),
            ...(logoPath ? { shopLogoPath: logoPath } : {}),
            ...(coverPath ? { shopCoverPath: coverPath } : {}),
          },
        });
        toast.success("Shop details updated");
        onSaved();
        onClose();
      } catch {
        toast.error("Could not save your shop details.");
      } finally {
        setSaving(false);
      }
    },
    [name, about, logoFile, coverFile, upload, save, onSaved, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101014] p-5 text-white sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Edit shop</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cover */}
        <button
          type="button"
          onClick={() => coverRef.current?.click()}
          className="relative mt-4 block h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A1F]"
        >
          {coverPreview ? (
            <img src={coverPreview} alt="" className="h-full w-full object-cover" />
          ) : null}
          <span className="absolute inset-0 grid place-items-center bg-black/40 text-xs font-bold">
            <span className="inline-flex items-center gap-2">
              <ImagePlus className="h-4 w-4" /> Change shop cover
            </span>
          </span>
        </button>
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setCoverFile(f);
            setCoverPreview(URL.createObjectURL(f));
          }}
        />

        {/* Logo */}
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A1F]"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="" className="h-full w-full object-cover" />
            ) : null}
            <span className="absolute inset-0 grid place-items-center bg-black/40">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setLogoFile(f);
              setLogoPreview(URL.createObjectURL(f));
            }}
          />
          <div className="min-w-0 flex-1">
            <label className="text-xs font-bold text-slate-400">Shop name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#17171C] px-3 py-2.5 text-sm font-semibold outline-none focus:border-white/25"
              placeholder="e.g. Aria Studio"
            />
          </div>
        </div>

        <label className="mt-4 block text-xs font-bold text-slate-400">About the shop</label>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={2000}
          rows={5}
          className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-[#17171C] px-3 py-2.5 text-sm outline-none focus:border-white/25"
          placeholder="Tell shoppers what you sell, delivery times, support…"
        />

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-white/12 bg-white/[0.04] text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save shop
          </button>
        </div>
      </form>
    </div>
  );
}
