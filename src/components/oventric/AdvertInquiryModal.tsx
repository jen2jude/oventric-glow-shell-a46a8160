import { useEffect, useMemo, useState } from "react";
import { X, Upload, Loader2, CheckCircle2, Trash2, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { submitAdInquiry } from "@/lib/ad-inquiries.functions";

type Tier = "text" | "image" | "video";

const CITIES: Record<string, string[]> = {
  Nigeria: [
    "Abia",
    "Adamawa",
    "Akwa Ibom",
    "Anambra",
    "Bauchi",
    "Bayelsa",
    "Benue",
    "Borno",
    "Cross River",
    "Delta",
    "Ebonyi",
    "Edo",
    "Ekiti",
    "Enugu",
    "FCT (Abuja)",
    "Gombe",
    "Imo",
    "Jigawa",
    "Kaduna",
    "Kano",
    "Katsina",
    "Kebbi",
    "Kogi",
    "Kwara",
    "Lagos",
    "Nasarawa",
    "Niger",
    "Ogun",
    "Ondo",
    "Osun",
    "Oyo",
    "Plateau",
    "Rivers",
    "Sokoto",
    "Taraba",
    "Yobe",
    "Zamfara",
  ],
  Ghana: [
    "Ahafo",
    "Ashanti",
    "Bono",
    "Bono East",
    "Central",
    "Eastern",
    "Greater Accra",
    "North East",
    "Northern",
    "Oti",
    "Savannah",
    "Upper East",
    "Upper West",
    "Volta",
    "Western",
    "Western North",
  ],
  "Rest of Africa": [
    "Kenya",
    "South Africa",
    "Egypt",
    "Morocco",
    "Ethiopia",
    "Uganda",
    "Tanzania",
    "Rwanda",
    "Senegal",
    "Côte d'Ivoire",
    "Cameroon",
    "Zambia",
    "Zimbabwe",
    "Angola",
    "Algeria",
    "Tunisia",
    "DR Congo",
    "Botswana",
    "Namibia",
    "Mozambique",
  ],
};

const CTA_TYPES = [
  { id: "whatsapp", label: "WhatsApp chat" },
  { id: "lead_form", label: "Lead form (emailed daily)" },
  { id: "website", label: "Website / landing page" },
];

const TIER_MIN_DAILY: Record<Tier, number> = { text: 0.5, image: 0.79, video: 0.99 };

export function AdvertInquiryModal({
  open,
  onClose,
  initialTier = "image",
}: {
  open: boolean;
  onClose: () => void;
  initialTier?: Tier;
}) {
  const { isAuthenticated, openGate } = useAuthGate();
  const submit = useServerFn(submitAdInquiry);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState(false);

  // Fields
  const [tier, setTier] = useState<Tier>(initialTier);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [objective, setObjective] = useState("awareness");
  const [header, setHeader] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [ctaType, setCtaType] = useState("website");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaWhatsapp, setCtaWhatsapp] = useState("");
  const [duration, setDuration] = useState(7);
  const [dailyBudget, setDailyBudget] = useState<number>(TIER_MIN_DAILY[initialTier]);
  const [countries, setCountries] = useState<string[]>(["Nigeria"]);
  const [cities, setCities] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState("18-45");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [notes, setNotes] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [videoPath, setVideoPath] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTier(initialTier);
    setDailyBudget(TIER_MIN_DAILY[initialTier]);
    setStep(1);
    setDone(false);
    setAck(false);
    setConfirmOpen(false);
  }, [open, initialTier]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (email && !contactEmail) setContactEmail(email);
    })();
  }, [open]);

  const total = useMemo(() => Math.max(0, duration * dailyBudget), [duration, dailyBudget]);

  const toggleFrom = (arr: string[], v: string, setter: (n: string[]) => void) => {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const availableCities = useMemo(
    () => countries.flatMap((c) => (CITIES[c] ?? []).map((city) => ({ country: c, city }))),
    [countries],
  );

  const uploadImage = async (file: File) => {
    if (imagePaths.length >= 5) {
      toast.error("Max 5 images");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? "anon";
      const key = `inquiries/${uid}/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
      const { error } = await supabase.storage
        .from("ad-media")
        .upload(key, file, { upsert: false });
      if (error) throw error;
      setImagePaths((p) => [...p, key]);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const uploadVideo = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video must be under 100 MB");
      return;
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? "anon";
      const key = `inquiries/${uid}/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
      const { error } = await supabase.storage
        .from("ad-media")
        .upload(key, file, { upsert: false });
      if (error) throw error;
      setVideoPath(key);
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const canGoNext = () => {
    if (step === 1) return !!tier && !!objective;
    if (step === 2) return contactName.trim().length > 1 && /.+@.+\..+/.test(contactEmail);
    if (step === 3)
      return header.trim().length > 0 && (ctaType !== "website" || ctaUrl.trim().length > 0);
    if (step === 4)
      return countries.length > 0 && duration >= 1 && dailyBudget >= TIER_MIN_DAILY[tier];
    return false;
  };

  const openConfirm = () => {
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    if (!canGoNext()) {
      toast.error("Please complete the required fields");
      return;
    }
    setConfirmOpen(true);
  };

  const doSubmit = async () => {
    if (!ack) return;
    setSaving(true);
    try {
      await submit({
        data: {
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
          company: company.trim() || null,
          website: website.trim() || null,
          tier,
          objective,
          header: header.trim(),
          description: description.trim() || null,
          body: body.trim() || null,
          cta_type: ctaType,
          cta_url: ctaUrl.trim() || null,
          cta_whatsapp: ctaWhatsapp.trim() || null,
          duration_days: duration,
          daily_budget_usd: dailyBudget,
          total_budget_usd: total,
          countries,
          cities,
          demographics: { age_range: ageRange, gender },
          image_paths: imagePaths,
          video_path: videoPath || null,
          video_url: videoUrl.trim() || null,
          notes: notes.trim() || null,
          acknowledged: true,
        },
      });
      setConfirmOpen(false);
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-light fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center bg-black/70">
      <div className="relative w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-[#141418] border border-white/10 sm:rounded-2xl rounded-t-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 h-14 bg-[#141418] border-b border-white/10">
          <div>
            <div className="text-sm font-black text-white">Advertise on Oventric</div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300">
              Step {step} of 4
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-[10px] hover:bg-white/5">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-black text-white">Submitted for review</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
              An admin will contact you shortly to confirm your creative and total budget. You'll be
              asked to fund your wallet with{" "}
              <span className="text-emerald-300 font-bold">${total.toFixed(2)}</span> before your
              campaign goes live.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black rounded-full"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {step === 1 && (
              <>
                <Label>Ad tier</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["text", "image", "video"] as Tier[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTier(t);
                        setDailyBudget(Math.max(dailyBudget, TIER_MIN_DAILY[t]));
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold capitalize ${tier === t ? "border-emerald-500 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-[#0f0f12] text-slate-300"}`}
                    >
                      {t}
                      <div className="text-[10px] text-slate-500 mt-1">
                        ${TIER_MIN_DAILY[t]}/day min
                      </div>
                    </button>
                  ))}
                </div>

                <Label>Objective</Label>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="input"
                >
                  <option value="awareness">Brand awareness</option>
                  <option value="traffic">Website traffic</option>
                  <option value="leads">Lead generation</option>
                  <option value="whatsapp">WhatsApp conversations</option>
                  <option value="sales">Product sales</option>
                </select>
              </>
            )}

            {step === 2 && (
              <>
                <Label>Contact name *</Label>
                <input
                  className="input"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Full name"
                />
                <Label>Email *</Label>
                <input
                  className="input"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@company.com"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Phone / WhatsApp</Label>
                    <input
                      className="input"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+234…"
                    />
                  </div>
                  <div>
                    <Label>Company</Label>
                    <input
                      className="input"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <Label>Website</Label>
                <input
                  className="input"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://…"
                />
              </>
            )}

            {step === 3 && (
              <>
                <Label>Header * (max 60 chars)</Label>
                <input
                  className="input"
                  maxLength={60}
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                  placeholder="Grab attention in one line"
                />
                <Label>Short description (max 140 chars)</Label>
                <input
                  className="input"
                  maxLength={140}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One-sentence hook"
                />
                {(tier === "video" || tier === "text") && (
                  <>
                    <Label>Body (max 500 chars)</Label>
                    <textarea
                      className="input min-h-[80px]"
                      maxLength={500}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Longer message shown with your ad"
                    />
                  </>
                )}

                <Label>CTA</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CTA_TYPES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCtaType(c.id)}
                      className={`p-2 rounded-[10px] border text-xs font-bold ${ctaType === c.id ? "border-emerald-500 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-[#0f0f12] text-slate-300"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {ctaType === "whatsapp" ? (
                  <input
                    className="input"
                    value={ctaWhatsapp}
                    onChange={(e) => setCtaWhatsapp(e.target.value)}
                    placeholder="WhatsApp number e.g. +2348012345678"
                  />
                ) : (
                  <input
                    className="input"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="Destination URL https://…"
                  />
                )}

                {tier === "image" && (
                  <>
                    <Label>Images (1:1, max 5, ≤5 MB each)</Label>
                    <div className="flex flex-wrap gap-2">
                      {imagePaths.map((p) => (
                        <div
                          key={p}
                          className="relative w-20 h-20 rounded-[10px] bg-[#0f0f12] border border-white/10 grid place-items-center text-[10px] text-slate-500"
                        >
                          <span className="truncate px-1">{p.split("/").pop()}</span>
                          <button
                            onClick={() => setImagePaths((arr) => arr.filter((x) => x !== p))}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white grid place-items-center"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {imagePaths.length < 5 && (
                        <label className="w-20 h-20 rounded-[10px] border-2 border-dashed border-white/10 grid place-items-center cursor-pointer hover:border-emerald-500/50">
                          {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                          ) : (
                            <Upload className="w-4 h-4 text-slate-500" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadImage(f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </>
                )}

                {tier === "video" && (
                  <>
                    <Label>Video (upload up to 100 MB, or paste a link)</Label>
                    {videoPath ? (
                      <div className="flex items-center gap-2 p-3 rounded-[10px] bg-[#0f0f12] border border-white/10">
                        <VideoIcon className="w-4 h-4 text-emerald-400" />
                        <span className="flex-1 text-xs text-slate-300 truncate">
                          {videoPath.split("/").pop()}
                        </span>
                        <button
                          onClick={() => setVideoPath("")}
                          className="text-red-400 text-xs font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 p-3 rounded-[10px] border-2 border-dashed border-white/10 cursor-pointer hover:border-emerald-500/50 text-xs text-slate-400">
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>Upload video (MP4 / WEBM, ≤5 min, ≤100 MB)</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadVideo(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    <input
                      className="input"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Or paste a YouTube / Vimeo link"
                    />
                  </>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <Label>Countries</Label>
                <div className="flex flex-wrap gap-2">
                  {["Nigeria", "Ghana", "Rest of Africa"].map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleFrom(countries, c, setCountries)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${countries.includes(c) ? "border-emerald-500 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-slate-300"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {availableCities.length > 0 && (
                  <>
                    <Label>States / regions (optional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableCities.map(({ city }) => (
                        <button
                          key={city}
                          onClick={() => toggleFrom(cities, city, setCities)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cities.includes(city) ? "border-emerald-500 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-slate-400"}`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Age range</Label>
                    <select
                      className="input"
                      value={ageRange}
                      onChange={(e) => setAgeRange(e.target.value)}
                    >
                      <option>18-24</option>
                      <option>18-34</option>
                      <option>18-45</option>
                      <option>25-45</option>
                      <option>25-55</option>
                      <option>all</option>
                    </select>
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <select
                      className="input"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as "all" | "male" | "female")}
                    >
                      <option value="all">All</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Duration (days)</Label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className="input"
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                  <div>
                    <Label>Daily budget (USD, min ${TIER_MIN_DAILY[tier]})</Label>
                    <input
                      type="number"
                      step="0.01"
                      min={TIER_MIN_DAILY[tier]}
                      className="input"
                      value={dailyBudget}
                      onChange={(e) =>
                        setDailyBudget(Math.max(TIER_MIN_DAILY[tier], Number(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>

                <div className="p-3 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-100 font-bold flex items-center justify-between">
                  <span>Estimated total</span>
                  <span className="text-lg font-black">${total.toFixed(2)}</span>
                </div>

                <Label>Notes for admin (optional)</Label>
                <textarea
                  className="input min-h-[70px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else our team should know?"
                />
              </>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                disabled={step === 1}
                className="px-4 py-2 text-xs font-bold text-slate-400 disabled:opacity-40"
              >
                Back
              </button>
              {step < 4 ? (
                <button
                  onClick={() =>
                    canGoNext()
                      ? setStep((s) => (s + 1) as 2 | 3 | 4)
                      : toast.error("Please fill the required fields")
                  }
                  className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={openConfirm}
                  className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        )}

        {confirmOpen && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-5">
            <div className="w-full max-w-md rounded-2xl bg-[#1a1a1f] border border-emerald-500/30 p-6">
              <h3 className="text-lg font-black text-white">One last thing</h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                An admin will contact you shortly regarding your campaign. Once approved, you'll be
                required to fund your wallet with{" "}
                <span className="text-emerald-300 font-bold">${total.toFixed(2)}</span> (equivalent
                of your ad total). Only then will the campaign go live.
              </p>
              <label className="mt-4 flex items-start gap-3 p-3 rounded-[10px] bg-[#0f0f12] border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500"
                />
                <span className="text-xs text-slate-300 font-semibold">
                  I acknowledge and agree to fund my wallet before the campaign starts.
                </span>
              </label>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 h-10 rounded-full bg-white/5 border border-white/10 text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={!ack || saving}
                  onClick={doSubmit}
                  className="flex-1 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirm & Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .input { width: 100%; padding: 10px 12px; border-radius: 10px; background: #0f0f12; border: 1px solid rgba(255,255,255,0.08); color: #e2e8f0; font-size: 13px; }
        .input:focus { outline: none; border-color: rgba(59, 130, 246,0.6); }
      `}</style>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 mt-2">
      {children}
    </div>
  );
}
