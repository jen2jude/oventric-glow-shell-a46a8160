import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Loader2,
  Plus,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Video,
  FileText,
  FileType2,
  GripVertical,
  Award,
  Rocket,
  Save,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveCourseWizard,
  getCourseCoverUploadUrl,
  getCourseMediaUploadUrl,
  type CourseCategory,
  type CourseLevel,
  type LessonType,
  type WizardSectionInput,
  type WizardQuizInput,
} from "@/lib/academy.functions";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { currencySymbol, usdRate } from "@/lib/fx-display";
import { supabase } from "@/integrations/supabase/client";
import { useIsAppShell } from "@/hooks/use-launch-context";

const CATEGORIES: { key: CourseCategory; label: string }[] = [
  { key: "frontend", label: "Frontend Dev" },
  { key: "uiux", label: "UI/UX Design" },
  { key: "ai", label: "AI Prompting" },
  { key: "backend", label: "Backend & DB" },
  { key: "security", label: "Cybersecurity" },
];
const LEVELS: { key: CourseLevel; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];
const CERT_TEMPLATES = [
  { key: "classic", label: "Classic" },
  { key: "modern", label: "Modern" },
  { key: "neon", label: "Neon" },
];

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS = ["Basics", "Curriculum", "Quizzes", "Settings", "Review"] as const;

interface Section extends WizardSectionInput {
  id: string;
}
interface Quiz extends WizardQuizInput {
  id: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function CoursePublishWizard({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const save = useServerFn(saveCourseWizard);
  const getUpload = useServerFn(getCourseCoverUploadUrl);
  const snapshotFx = useServerFn(snapshotFxRates);
  const { baseCurrency } = useOnboarding();
  const isAppShell = useIsAppShell();

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState<null | "draft" | "publish">(null);
  const [confetti, setConfetti] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Step 1 — Basics
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [category, setCategory] = useState<CourseCategory>("frontend");
  const [level, setLevel] = useState<CourseLevel>("beginner");

  // Step 2 — Curriculum
  const [sections, setSections] = useState<Section[]>([
    { id: uid(), title: "Module 1: Introduction", lessons: [] },
  ]);

  // Step 3 — Quizzes
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  // Step 4 — Settings
  const [isFree, setIsFree] = useState(true);
  const [priceLocal, setPriceLocal] = useState(0);
  const [requireLinear, setRequireLinear] = useState(false);
  const [issueCertificate, setIssueCertificate] = useState(false);
  const [certificateTemplate, setCertificateTemplate] = useState<string>("classic");

  useEffect(() => {
    if (!open) {
      setStep(0);
      setConfetti(false);
    }
  }, [open]);

  const totalLessons = useMemo(
    () => sections.reduce((n, s) => n + s.lessons.length, 0),
    [sections],
  );

  const canGoNext = () => {
    if (step === 0) return title.trim().length >= 3;
    if (step === 1) return totalLessons > 0;
    return true;
  };

  const handleCoverUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Cover must be under 5MB");
    setUploading(true);
    try {
      const { path, token } = await getUpload({ data: { filename: file.name } });
      const { error } = await supabase.storage
        .from("course-covers")
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("course-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      setCoverPath(path);
      setCoverPreview(signed?.signedUrl ?? null);
      toast.success("Cover uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = async (publish: boolean) => {
    let priceUSD = 0;
    let originalAmount = priceLocal;
    let fxSnapshot: Awaited<ReturnType<typeof snapshotFx>> | null = null;
    if (!isFree) {
      fxSnapshot = await snapshotFx();
      const rate = fxSnapshot.rates[baseCurrency] ?? usdRate(baseCurrency);
      priceUSD =
        baseCurrency === "USD" ? priceLocal : Number((priceLocal / (rate || 1)).toFixed(2));
      originalAmount = priceLocal;
    }
    return {
      title,
      subtitle,
      description: subtitle, // short description mirrors subtitle
      longDescription: longDesc,
      category,
      level,
      coverPath,
      sections: sections.map((s) => ({
        title: s.title,
        lessons: s.lessons,
      })),
      quizzes: quizzes.map((q) => ({
        title: q.title,
        passingGrade: q.passingGrade,
        questions: q.questions,
      })),
      isFree,
      priceUSD,
      originalCurrency: baseCurrency,
      originalAmount,
      fxSnapshot,
      requireLinear,
      issueCertificate,
      certificateTemplate: issueCertificate ? certificateTemplate : null,
      isPublished: publish,
    };
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) return toast.error("Title required");
    if (publish && totalLessons === 0) return toast.error("Add at least one lesson to publish");
    if (!isFree && !(priceLocal > 0)) return toast.error("Set a price or mark the course as free");
    setSaving(publish ? "publish" : "draft");
    try {
      const payload = await buildPayload(publish);
      const res = await save({ data: payload });
      toast.success(publish ? "Course published" : "Draft saved");
      if (publish) {
        setConfetti(true);
        setTimeout(() => {
          onSaved?.(res.id);
          onClose();
        }, 1400);
      } else {
        onSaved?.(res.id);
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (!open) return null;

  const body = (
    <div
      className={`modal-light fixed inset-0 z-[70] flex ${
        isAppShell ? "items-end" : "items-center justify-center p-2 sm:p-6"
      }`}
    >
      <div className="absolute inset-0 bg-black/80" onClick={isAppShell ? undefined : onClose} />
      <div
        className={`relative w-full bg-[#1E1E24] border border-white/10 shadow-2xl flex flex-col overflow-hidden ${
          isAppShell
            ? "max-h-[92dvh] rounded-t-3xl"
            : "max-w-5xl max-h-[95vh] rounded-2xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-lg font-black text-white">Publish a Course</h2>
            <p className="text-xs text-slate-500">
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className={`border-b border-white/10 shrink-0 ${isAppShell ? "px-4 py-3" : "px-4 sm:px-5 py-3"}`}>
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const upcoming = i > step;
              const isLast = i === STEPS.length - 1;

              return (
                <div key={s} className="flex-1 flex items-center">
                  <button
                    onClick={() => i <= step && setStep(i as Step)}
                    disabled={upcoming}
                    className={`relative flex flex-col items-center justify-center gap-1.5 w-full transition-all duration-200 ${
                      upcoming ? "cursor-default" : "cursor-pointer"
                    }`}
                  >
                    <div
                      className={`relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full grid place-items-center text-xs font-bold transition-all duration-200 ${
                        active
                          ? "bg-emerald-500 text-black scale-105"
                          : done
                            ? "bg-emerald-500 text-black"
                            : "bg-[#16161A] text-slate-500 border border-white/10"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className={active ? "text-black" : "text-slate-500"}>{i + 1}</span>
                      )}
                    </div>
                    {!isAppShell && (
                      <span
                        className={`text-[10px] sm:text-[11px] font-medium transition-colors duration-200 ${
                          active ? "text-emerald-300" : done ? "text-emerald-400/80" : "text-slate-500"
                        }`}
                      >
                        {s}
                      </span>
                    )}
                  </button>

                  {!isLast && (
                    <div className="flex-1 h-[2px] mx-1 sm:mx-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
                        style={{ width: done ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${isAppShell ? "p-5 pb-24" : "p-4 sm:p-6"}`}>
          {step === 0 && (
            <BasicsStep
              isAppShell={isAppShell}
              title={title}
              setTitle={setTitle}
              subtitle={subtitle}
              setSubtitle={setSubtitle}
              longDesc={longDesc}
              setLongDesc={setLongDesc}
              category={category}
              setCategory={setCategory}
              level={level}
              setLevel={setLevel}
              coverPreview={coverPreview}
              coverPath={coverPath}
              uploading={uploading}
              onCoverUpload={handleCoverUpload}
            />
          )}
          {step === 1 && <CurriculumStep isAppShell={isAppShell} sections={sections} setSections={setSections} />}
          {step === 2 && <QuizzesStep isAppShell={isAppShell} quizzes={quizzes} setQuizzes={setQuizzes} />}
          {step === 3 && (
            <SettingsStep
              isAppShell={isAppShell}
              isFree={isFree}
              setIsFree={setIsFree}
              priceLocal={priceLocal}
              setPriceLocal={setPriceLocal}
              baseCurrency={baseCurrency}
              requireLinear={requireLinear}
              setRequireLinear={setRequireLinear}
              issueCertificate={issueCertificate}
              setIssueCertificate={setIssueCertificate}
              certificateTemplate={certificateTemplate}
              setCertificateTemplate={setCertificateTemplate}
            />
          )}
          {step === 4 && (
            <ReviewStep
              isAppShell={isAppShell}
              title={title}
              subtitle={subtitle}
              sections={sections}
              quizzes={quizzes}
              isFree={isFree}
              priceLocal={priceLocal}
              baseCurrency={baseCurrency}
              requireLinear={requireLinear}
              issueCertificate={issueCertificate}
              certificateTemplate={certificateTemplate}
              totalLessons={totalLessons}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between gap-2 border-t border-white/10 shrink-0 ${
            isAppShell
              ? "fixed bottom-0 left-0 right-0 p-4 bg-[#16161A] z-10 rounded-t-2xl"
              : "p-4 bg-[#121214]/70"
          }`}
        >
          <button
            onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
            disabled={step === 0 || saving !== null}
            className={`inline-flex items-center gap-1 rounded-[10px] text-sm text-slate-300 disabled:opacity-40 ${
              isAppShell
                ? "px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 font-semibold"
                : "px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10"
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            {step === 4 ? (
              <>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving !== null}
                  className={`inline-flex items-center gap-1 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white disabled:opacity-40 ${
                    isAppShell ? "px-4 py-3 font-semibold" : "px-3 py-2"
                  }`}
                >
                  {saving === "draft" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save as Draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving !== null || totalLessons === 0 || !title.trim()}
                  className={`inline-flex items-center gap-1 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40 ${
                    isAppShell ? "px-5 py-3" : "px-4 py-2"
                  }`}
                >
                  {saving === "publish" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  Publish Course
                </button>
              </>
            ) : (
              <button
                onClick={() => canGoNext() && setStep((s) => Math.min(4, s + 1) as Step)}
                disabled={!canGoNext()}
                className={`inline-flex items-center gap-1 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40 ${
                  isAppShell ? "px-5 py-3" : "px-4 py-2"
                }`}
              >
                Save & Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {confetti && <ConfettiOverlay />}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

/* -------------------- STEPS -------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
      {children}
    </div>
  );
}
const inputCls =
  "w-full px-3 py-2 rounded-[10px] bg-[#121214] border border-white/10 text-white text-sm placeholder:text-slate-600 outline-none focus:border-emerald-500/50";

function BasicsStep(props: {
  isAppShell: boolean;
  title: string;
  setTitle: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  longDesc: string;
  setLongDesc: (v: string) => void;
  category: CourseCategory;
  setCategory: (v: CourseCategory) => void;
  level: CourseLevel;
  setLevel: (v: CourseLevel) => void;
  coverPreview: string | null;
  coverPath: string | null;
  uploading: boolean;
  onCoverUpload: (file: File) => void;
}) {
  const {
    isAppShell,
    title,
    setTitle,
    subtitle,
    setSubtitle,
    longDesc,
    setLongDesc,
    category,
    setCategory,
    level,
    setLevel,
    coverPreview,
    coverPath,
    uploading,
    onCoverUpload,
  } = props;
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Label>Course Title *</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Mastering React Server Components"
          className={inputCls}
        />
      </div>
      <div>
        <Label>Subtitle / Short Description</Label>
        <textarea
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          rows={2}
          placeholder="One-line hook shown on the catalog card"
          className={`${inputCls} resize-none`}
        />
      </div>
      <div>
        <Label>Long Description</Label>
        <textarea
          value={longDesc}
          onChange={(e) => setLongDesc(e.target.value)}
          rows={6}
          placeholder="Deep dive: what learners will build, prerequisites, outcomes…"
          className={`${inputCls} resize-none`}
        />
        <p className="text-[11px] text-slate-500 mt-1">Markdown supported when rendered.</p>
      </div>
      <div>
        <Label>Course Thumbnail (up to 5MB)</Label>
        {isAppShell ? (
          <label className="cursor-pointer block relative w-full aspect-[16/10] rounded-xl bg-[#121214] border border-dashed border-white/15 overflow-hidden">
            {coverPreview ? (
              <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="w-14 h-14 rounded-full bg-white/5 grid place-items-center">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold">{uploading ? "Uploading…" : "Tap to upload thumbnail"}</span>
              </div>
            )}
            {coverPreview && (
              <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-[10px] bg-black/70 text-white text-xs font-semibold backdrop-blur-sm">
                {uploading ? "Uploading…" : "Change"}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && onCoverUpload(e.target.files[0])}
            />
          </label>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-32 h-20 rounded-[10px] bg-[#121214] border border-white/10 grid place-items-center overflow-hidden">
              {coverPreview ? (
                <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
              ) : (
                <FileType2 className="w-6 h-6 text-slate-600" />
              )}
            </div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading…" : coverPath ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && onCoverUpload(e.target.files[0])}
              />
            </label>
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CourseCategory)}
            className={inputCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Difficulty Level</Label>
          <div className="flex gap-1 p-1 rounded-[10px] bg-[#121214] border border-white/10">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLevel(l.key)}
                className={`flex-1 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors ${
                  level === l.key ? "bg-emerald-500 text-black" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CurriculumStep({
  isAppShell,
  sections,
  setSections,
}: {
  isAppShell: boolean;
  sections: Section[];
  setSections: (s: Section[]) => void;
}) {
  const addSection = () => {
    setSections([...sections, { id: uid(), title: `Module ${sections.length + 1}`, lessons: [] }]);
  };
  const updateSection = (id: string, patch: Partial<Section>) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeSection = (id: string) => {
    if (!confirm("Delete this section and its lessons?")) return;
    setSections(sections.filter((s) => s.id !== id));
  };
  const addLesson = (sectionId: string) => {
    updateSection(sectionId, {
      lessons: [
        ...(sections.find((s) => s.id === sectionId)?.lessons ?? []),
        {
          title: "New Lesson",
          type: "video",
          isPreview: false,
          durationMin: 0,
          content: { url: "" },
        },
      ],
    });
  };
  const updateLesson = (
    sectionId: string,
    idx: number,
    patch: Partial<Section["lessons"][number]>,
  ) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const next = section.lessons.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    updateSection(sectionId, { lessons: next });
  };
  const removeLesson = (sectionId: string, idx: number) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, { lessons: section.lessons.filter((_, i) => i !== idx) });
  };

  return (
    <div className={`space-y-4 max-w-3xl ${isAppShell ? "pb-4" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Organise your course into sections. Each section can hold video, text, or PDF lessons.
        </p>
        <button
          onClick={addSection}
          className={`inline-flex items-center gap-1 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold shrink-0 ${
            isAppShell ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs"
          }`}
        >
          <Plus className="w-4 h-4" /> Add Section
        </button>
      </div>

      {sections.length === 0 && (
        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-slate-500 text-sm">
          No sections yet. Add your first module to get started.
        </div>
      )}

      {sections.map((section, sIdx) => (
        <div
          key={section.id}
          className="rounded-xl bg-[#121214] border border-white/10 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-500">Section {sIdx + 1}</span>
            <input
              value={section.title}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              className="flex-1 bg-transparent border-b border-white/10 focus:border-emerald-500/50 outline-none text-white font-semibold text-sm px-1 py-1"
            />
            <button
              onClick={() => removeSection(section.id)}
              className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {section.lessons.map((lesson, lIdx) => (
              <LessonRow
                key={lIdx}
                lesson={lesson}
                onChange={(patch) => updateLesson(section.id, lIdx, patch)}
                onRemove={() => removeLesson(section.id, lIdx)}
              />
            ))}
            <button
              onClick={() => addLesson(section.id)}
              className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-dashed border-white/10 text-slate-300 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Add Lesson
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LessonRow({
  lesson,
  onChange,
  onRemove,
}: {
  lesson: Section["lessons"][number];
  onChange: (patch: Partial<Section["lessons"][number]>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = lesson.type === "text" ? FileText : lesson.type === "pdf" ? FileType2 : Video;
  return (
    <div className="rounded-[10px] bg-[#1E1E24] border border-white/10">
      <div className="flex items-center gap-2 p-2">
        <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
        <input
          value={lesson.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="flex-1 bg-transparent outline-none text-white text-sm px-1"
          placeholder="Lesson title"
        />
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1"
        >
          {open ? "Hide" : "Edit"}
        </button>
        <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-500/10 text-red-400">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <div className="p-3 pt-1 space-y-3 border-t border-white/10">
          <div className="grid sm:grid-cols-3 gap-2">
            <div>
              <Label>Type</Label>
              <select
                value={lesson.type}
                onChange={(e) => {
                  const t = e.target.value as LessonType;
                  onChange({
                    type: t,
                    content:
                      t === "video" ? { url: "" } : t === "text" ? { html: "" } : { url: "" },
                  });
                }}
                className={inputCls}
              >
                <option value="video">Video</option>
                <option value="text">Text / HTML</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div>
              <Label>Duration (min)</Label>
              <input
                type="number"
                min={0}
                value={lesson.durationMin ?? 0}
                onChange={(e) => onChange({ durationMin: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={Boolean(lesson.isPreview)}
                onChange={(e) => onChange({ isPreview: e.target.checked })}
                className="accent-emerald-500"
              />
              <span className="text-sm text-white">Free preview lesson</span>
            </label>
          </div>
          {lesson.type === "video" && <VideoLessonEditor lesson={lesson} onChange={onChange} />}
          {lesson.type === "text" && (
            <div>
              <Label>Lesson Body (rich text)</Label>
              <RichTextEditor
                value={String(lesson.content?.html ?? "")}
                onChange={(html) => onChange({ content: { ...lesson.content, html } })}
                placeholder="Write full lesson notes. Insert images and screenshots inline."
              />
            </div>
          )}
          {lesson.type === "pdf" && (
            <div>
              <Label>PDF URL</Label>
              <input
                value={String(lesson.content?.url ?? "")}
                onChange={(e) => onChange({ content: { ...lesson.content, url: e.target.value } })}
                placeholder="https://…/lesson.pdf"
                className={inputCls}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VideoLessonEditor({
  lesson,
  onChange,
}: {
  lesson: Section["lessons"][number];
  onChange: (patch: Partial<Section["lessons"][number]>) => void;
}) {
  const getUpload = useServerFn(getCourseMediaUploadUrl);
  const [uploading, setUploading] = useState(false);
  const videoPath =
    typeof lesson.content?.video_path === "string" ? (lesson.content.video_path as string) : "";
  const url = String(lesson.content?.url ?? "");
  const body = String(lesson.content?.body ?? "");

  const upload = async (file: File) => {
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) return toast.error("Video must be ≤ 500 MB");
    setUploading(true);
    try {
      const { path, signedUrl } = await getUpload({ data: { filename: file.name, kind: "video" } });
      const res = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "video/mp4" },
      });
      if (!res.ok) throw new Error("Upload failed");
      onChange({ content: { ...lesson.content, video_path: path } });
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Video URL (YouTube or Vimeo)</Label>
        <input
          value={url}
          onChange={(e) => onChange({ content: { ...lesson.content, url: e.target.value } })}
          placeholder="https://youtu.be/… or https://vimeo.com/…"
          className={inputCls}
        />
      </div>
      <div>
        <Label>Or upload a video file (≤ 500 MB)</Label>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-slate-200 cursor-pointer">
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading…" : videoPath ? "Replace video" : "Choose video"}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
          </label>
          {videoPath && (
            <button
              type="button"
              onClick={() => onChange({ content: { ...lesson.content, video_path: null } })}
              className="text-xs text-red-300 hover:text-red-200"
            >
              Remove upload
            </button>
          )}
        </div>
      </div>
      <div>
        <Label>Module Body (rich text)</Label>
        <RichTextEditor
          value={body}
          onChange={(html) => onChange({ content: { ...lesson.content, body: html } })}
          placeholder="Add full written notes, screenshots, or images to accompany the video."
        />
      </div>
    </div>
  );
}

function QuizzesStep({
  isAppShell,
  quizzes,
  setQuizzes,
}: {
  isAppShell: boolean;
  quizzes: Quiz[];
  setQuizzes: (q: Quiz[]) => void;
}) {
  const addQuiz = () => {
    setQuizzes([
      ...quizzes,
      { id: uid(), title: `Quiz ${quizzes.length + 1}`, passingGrade: 80, questions: [] },
    ]);
  };
  const updateQuiz = (id: string, patch: Partial<Quiz>) => {
    setQuizzes(quizzes.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };
  const removeQuiz = (id: string) => setQuizzes(quizzes.filter((q) => q.id !== id));
  const addQuestion = (quizId: string) => {
    const q = quizzes.find((x) => x.id === quizId);
    if (!q) return;
    updateQuiz(quizId, {
      questions: [
        ...q.questions,
        {
          text: "New question",
          type: "multiple",
          options: [
            { text: "Option A", correct: true },
            { text: "Option B", correct: false },
          ],
        },
      ],
    });
  };
  const updateQuestion = (
    quizId: string,
    idx: number,
    patch: Partial<Quiz["questions"][number]>,
  ) => {
    const q = quizzes.find((x) => x.id === quizId);
    if (!q) return;
    updateQuiz(quizId, {
      questions: q.questions.map((qq, i) => (i === idx ? { ...qq, ...patch } : qq)),
    });
  };
  const removeQuestion = (quizId: string, idx: number) => {
    const q = quizzes.find((x) => x.id === quizId);
    if (!q) return;
    updateQuiz(quizId, { questions: q.questions.filter((_, i) => i !== idx) });
  };

  return (
    <div className={`space-y-4 max-w-3xl ${isAppShell ? "pb-4" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Quizzes are optional. Add one to the end of the course to gate certificates.
        </p>
        <button
          onClick={addQuiz}
          className={`inline-flex items-center gap-1 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold shrink-0 ${
            isAppShell ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs"
          }`}
        >
          <Plus className="w-4 h-4" /> Add Quiz
        </button>
      </div>

      {quizzes.length === 0 && (
        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-slate-500 text-sm">
          No quizzes added. You can skip this step or add one to test learners.
        </div>
      )}

      {quizzes.map((quiz) => (
        <div key={quiz.id} className="rounded-xl bg-[#121214] border border-white/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={quiz.title}
              onChange={(e) => updateQuiz(quiz.id, { title: e.target.value })}
              className="flex-1 bg-transparent border-b border-white/10 focus:border-emerald-500/50 outline-none text-white font-semibold text-sm px-1 py-1"
            />
            <button
              onClick={() => removeQuiz(quiz.id)}
              className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div>
            <Label>Passing Grade: {quiz.passingGrade}%</Label>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={quiz.passingGrade}
              onChange={(e) => updateQuiz(quiz.id, { passingGrade: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>
          <div className="space-y-2">
            {quiz.questions.map((q, qIdx) => (
              <QuestionCard
                key={qIdx}
                question={q}
                onChange={(patch) => updateQuestion(quiz.id, qIdx, patch)}
                onRemove={() => removeQuestion(quiz.id, qIdx)}
              />
            ))}
            <button
              onClick={() => addQuestion(quiz.id)}
              className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-dashed border-white/10 text-slate-300 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionCard({
  question,
  onChange,
  onRemove,
}: {
  question: Quiz["questions"][number];
  onChange: (patch: Partial<Quiz["questions"][number]>) => void;
  onRemove: () => void;
}) {
  const setOptions = (opts: { text: string; correct: boolean }[]) => onChange({ options: opts });
  const setCorrect = (idx: number) => {
    setOptions(question.options.map((o, i) => ({ ...o, correct: i === idx })));
  };
  const setType = (t: "multiple" | "boolean") => {
    if (t === "boolean") {
      onChange({
        type: t,
        options: [
          { text: "True", correct: true },
          { text: "False", correct: false },
        ],
      });
    } else {
      onChange({
        type: t,
        options: [
          { text: "Option A", correct: true },
          { text: "Option B", correct: false },
        ],
      });
    }
  };
  return (
    <div className="rounded-[10px] bg-[#1E1E24] border border-white/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={question.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="flex-1 bg-transparent border-b border-white/10 focus:border-emerald-500/50 outline-none text-white text-sm px-1 py-1"
          placeholder="Question text"
        />
        <select
          value={question.type}
          onChange={(e) => setType(e.target.value as "multiple" | "boolean")}
          className={inputCls + " max-w-[140px]"}
        >
          <option value="multiple">Multiple choice</option>
          <option value="boolean">True / False</option>
        </select>
        <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-500/10 text-red-400">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1.5">
        {question.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              checked={o.correct}
              onChange={() => setCorrect(i)}
              className="accent-emerald-500"
            />
            <input
              value={o.text}
              onChange={(e) =>
                setOptions(
                  question.options.map((op, idx) =>
                    idx === i ? { ...op, text: e.target.value } : op,
                  ),
                )
              }
              className="flex-1 bg-[#121214] border border-white/10 rounded px-2 py-1 text-sm text-white outline-none"
            />
            {question.type === "multiple" && question.options.length > 2 && (
              <button
                onClick={() => setOptions(question.options.filter((_, idx) => idx !== i))}
                className="p-1 rounded hover:bg-red-500/10 text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {question.type === "multiple" && (
          <button
            onClick={() =>
              setOptions([
                ...question.options,
                {
                  text: `Option ${String.fromCharCode(65 + question.options.length)}`,
                  correct: false,
                },
              ])
            }
            className="text-[11px] text-emerald-400 hover:text-emerald-300"
          >
            + Add option
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsStep(props: {
  isAppShell: boolean;
  isFree: boolean;
  setIsFree: (v: boolean) => void;
  priceLocal: number;
  setPriceLocal: (v: number) => void;
  baseCurrency: Currency;
  requireLinear: boolean;
  setRequireLinear: (v: boolean) => void;
  issueCertificate: boolean;
  setIssueCertificate: (v: boolean) => void;
  certificateTemplate: string;
  setCertificateTemplate: (v: string) => void;
}) {
  const {
    isAppShell,
    isFree,
    setIsFree,
    priceLocal,
    setPriceLocal,
    baseCurrency,
    requireLinear,
    setRequireLinear,
    issueCertificate,
    setIssueCertificate,
    certificateTemplate,
    setCertificateTemplate,
  } = props;
  return (
    <div className={`space-y-5 max-w-3xl ${isAppShell ? "pb-4" : ""}`}>
      <section className="rounded-xl bg-[#121214] border border-white/10 p-4 space-y-3">
        <div className="text-sm font-bold text-white">Access Control</div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsFree(true)}
            className={`flex-1 rounded-[10px] border font-semibold ${
              isAppShell ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
            } ${isFree ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-slate-300"}`}
          >
            Free
          </button>
          <button
            onClick={() => setIsFree(false)}
            className={`flex-1 rounded-[10px] border font-semibold ${
              isAppShell ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
            } ${!isFree ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-slate-300"}`}
          >
            Paid
          </button>
        </div>
        {!isFree && (
          <div>
            <Label>
              Price ({currencySymbol(baseCurrency)} {baseCurrency}) · locked at publish
            </Label>
            <input
              type="number"
              min={0}
              step={1}
              value={priceLocal}
              onChange={(e) => setPriceLocal(Number(e.target.value))}
              className={`${inputCls} ${isAppShell ? "py-3 text-base" : ""}`}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Buyers in other currencies see the equivalent locked at publish time.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-[#121214] border border-white/10 p-4 space-y-3">
        <div className="text-sm font-bold text-white">Completion Rules</div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={requireLinear}
            onChange={(e) => setRequireLinear(e.target.checked)}
            className="accent-emerald-500"
          />
          <span className="text-sm text-white">
            Require linear progression{" "}
            <span className="text-slate-500">
              (learners must finish lesson 1 before seeing lesson 2)
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-xl bg-[#121214] border border-white/10 p-4 space-y-3">
        <div className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-400" /> Certificate
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={issueCertificate}
            onChange={(e) => setIssueCertificate(e.target.checked)}
            className="accent-emerald-500"
          />
          <span className="text-sm text-white">Issue certificate on completion</span>
        </label>
        {issueCertificate && (
          <div>
            <Label>Certificate template</Label>
            <select
              value={certificateTemplate}
              onChange={(e) => setCertificateTemplate(e.target.value)}
              className={inputCls}
            >
              {CERT_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewStep(props: {
  isAppShell: boolean;
  title: string;
  subtitle: string;
  sections: Section[];
  quizzes: Quiz[];
  isFree: boolean;
  priceLocal: number;
  baseCurrency: Currency;
  requireLinear: boolean;
  issueCertificate: boolean;
  certificateTemplate: string;
  totalLessons: number;
}) {
  const {
    isAppShell,
    title,
    subtitle,
    sections,
    quizzes,
    isFree,
    priceLocal,
    baseCurrency,
    requireLinear,
    issueCertificate,
    certificateTemplate,
    totalLessons,
  } = props;
  const missing: string[] = [];
  if (!title.trim()) missing.push("Course title");
  if (totalLessons === 0) missing.push("At least one lesson");
  return (
    <div className="space-y-4 max-w-3xl">
      {missing.length > 0 && (
        <div className="p-3 rounded-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          Fix before publishing: {missing.join(", ")}.
        </div>
      )}
      <div className="rounded-xl bg-[#121214] border border-white/10 p-5">
        <div className="text-2xl font-black text-white">{title || "Untitled Course"}</div>
        {subtitle && <div className="text-sm text-slate-400 mt-1">{subtitle}</div>}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Stat label="Sections" value={sections.length} />
          <Stat label="Lessons" value={totalLessons} />
          <Stat label="Quizzes" value={quizzes.length} />
          <Stat
            label="Price"
            value={isFree ? "Free" : `${currencySymbol(baseCurrency)}${priceLocal}`}
          />
        </div>
        <div className="mt-4 text-xs text-slate-400 space-y-1">
          <div>· Linear progression: {requireLinear ? "on" : "off"}</div>
          <div>
            · Certificate on completion: {issueCertificate ? `on (${certificateTemplate})` : "off"}
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-[#121214] border border-white/10 p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Curriculum preview
        </div>
        {sections.map((s, i) => (
          <div key={s.id} className="mb-3">
            <div className="text-sm font-semibold text-white">
              {i + 1}. {s.title || "Untitled section"}
            </div>
            <ul className="mt-1 ml-4 space-y-0.5">
              {s.lessons.map((l, j) => (
                <li key={j} className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="text-slate-600">
                    {i + 1}.{j + 1}
                  </span>{" "}
                  {l.title || "Untitled lesson"} <span className="text-slate-600">· {l.type}</span>{" "}
                  {l.isPreview && <span className="text-emerald-400">· preview</span>}
                </li>
              ))}
              {s.lessons.length === 0 && (
                <li className="text-xs text-slate-600">No lessons in this section.</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[10px] bg-[#1E1E24] border border-white/10 py-3">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function ConfettiOverlay() {
  const pieces = Array.from({ length: 60 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 0.8 + Math.random() * 0.9;
        const hue = Math.floor(Math.random() * 360);
        return (
          <span
            key={i}
            className="absolute top-0 w-1.5 h-3 rounded-sm"
            style={{
              left: `${left}%`,
              background: `hsl(${hue}, 90%, 60%)`,
              animation: `confetti-fall ${duration}s ${delay}s ease-in forwards`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
