import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  CheckCircle2,
  Circle,
  Loader2,
  Clock,
  Users,
  GraduationCap,
  Sparkles,
  Award,
  Lock,
  Edit3,
  Video,
  RotateCcw,
  ScrollText,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import {
  listCourses,
  getCourse,
  enrollFree,
  getMyEnrollment,
  markModuleComplete,
  unmarkModuleComplete,
  type CourseDTO,
  type CourseWithModulesDTO,
  type ModuleDTO,
  type EnrollmentDTO,
} from "@/lib/academy.functions";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { CourseEditorModal } from "./CourseEditorModal";
import { CoursePublishWizard } from "./CoursePublishWizard";
import { CourseCheckoutModal } from "./CourseCheckoutModal";
import { useIsAppShell } from "@/hooks/use-launch-context";

import { computeDisplayPrice } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { AdSlot } from "@/components/oventric/ads/AdSlot";
import { AcademyRecommendations } from "@/components/oventric/AcademyRecommendations";

function courseDisplayPrice(
  c: { priceUSD: number; originalCurrency: Currency; originalAmount: number; fxSnapshot: any },
  viewer: Currency,
) {
  return computeDisplayPrice(
    {
      price_usd: c.priceUSD,
      original_currency: c.originalCurrency,
      original_amount: c.originalAmount,
      fx_snapshot: c.fxSnapshot,
    },
    viewer,
  );
}

const CATEGORIES = [
  { key: "all", label: "✨ All Courses" },
  { key: "frontend", label: "💻 Frontend" },
  { key: "uiux", label: "🎨 UI/UX" },
  { key: "ai", label: "🤖 AI" },
  { key: "backend", label: "🗄️ Backend" },
  { key: "security", label: "🛡️ Security" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

function embedUrl(m: ModuleDTO): string {
  const raw = m.videoUrl.trim();
  if (m.videoProvider === "vimeo" || /vimeo\.com/i.test(raw)) {
    const match = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : raw;
  }
  const yt =
    raw.match(/[?&]v=([\w-]+)/)?.[1] ||
    raw.match(/youtu\.be\/([\w-]+)/)?.[1] ||
    raw.match(/youtube\.com\/embed\/([\w-]+)/)?.[1];
  return yt ? `https://www.youtube.com/embed/${yt}` : raw;
}

export function Academy() {
  const { baseCurrency } = useOnboarding();
  const isAppShell = useIsAppShell();
  const fetchList = useServerFn(listCourses);
  const [view, setView] = useState<"catalog" | "course">("catalog");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [courses, setCourses] = useState<CourseDTO[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserId(s?.user?.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchList()
      .then(setCourses)
      .catch((e) => {
        toast.error(e.message);
        setCourses([]);
      });
  }, [fetchList, refreshKey]);

  if (view === "course" && selectedId) {
    return (
      <CourseDetail
        courseId={selectedId}
        userId={userId}
        isAppShell={isAppShell}
        onBack={() => setView("catalog")}
        onEdit={(id) => {
          setEditingId(id);
          setEditorOpen(true);
        }}
      />
    );
  }

  // Currency isolation: signed-in users only see courses priced in their home
  // currency (or free). Anon viewers see everything (USD preview).
  const filtered =
    courses?.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (!userId) return true;
      if (c.isFree) return true;
      const oc = String(c.originalCurrency ?? "USD").toUpperCase();
      return oc === baseCurrency;
    }) ?? [];

  return (
    <div className={`w-full ${!isAppShell ? "bg-white min-h-screen" : "md:bg-white md:min-h-screen"}`}>
      <AcademyHero isAppShell={isAppShell} />

      <div className="max-w-6xl mx-auto w-full">
        <div className={`sticky top-0 z-30 px-4 py-3 border-b ${!isAppShell ? "bg-white border-slate-200" : "bg-[#121214] border-white/5 md:bg-white md:border-slate-200"}`}>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className={`${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"} font-black text-lg`}>Browse courses</h2>
            {userId && (
              <button
                onClick={() => {
                  setEditingId(undefined);
                  setEditorOpen(true);
                }}
                className="ml-auto inline-flex items-center gap-2 text-sm text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg px-3 py-1.5 font-bold"
              >
                <GraduationCap className="w-4 h-4" /> Publish a Course
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                    active
                      ? !isAppShell
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 md:bg-emerald-600 md:border-emerald-600 md:text-white"
                      : !isAppShell
                        ? "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
                        : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white hover:border-white/20 md:bg-white md:border-slate-200 md:text-slate-600 md:hover:text-slate-900 md:hover:border-slate-300"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          <AdSlot placement="academy" variant="banner" />
          {courses === null && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`${!isAppShell ? "bg-white border-slate-200" : "bg-[#1E1E24] border-white/10 md:bg-white md:border-slate-200"} rounded-xl overflow-hidden animate-pulse`}
                >
                  <div className={`aspect-video ${!isAppShell ? "bg-slate-100" : "bg-white/5 md:bg-slate-100"}`} />
                  <div className="p-4 space-y-2">
                    <div className={`h-4 ${!isAppShell ? "bg-slate-200" : "bg-white/10 md:bg-slate-200"} rounded w-3/4`} />
                    <div className={`h-3 ${!isAppShell ? "bg-slate-100" : "bg-white/5 md:bg-slate-100"} rounded w-1/2`} />
                    <div className={`h-3 ${!isAppShell ? "bg-slate-100" : "bg-white/5 md:bg-slate-100"} rounded w-2/3 mt-3`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {courses !== null && filtered.length === 0 && (
            <div className={`text-center py-16 border border-dashed ${!isAppShell ? "border-slate-300" : "border-white/10 md:border-slate-300"} rounded-xl`}>
              <GraduationCap className={`w-10 h-10 ${!isAppShell ? "text-slate-400" : "text-slate-600 md:text-slate-400"} mx-auto mb-3`} />
              <div className={`${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"} font-bold`}>No courses yet</div>
              <p className="text-sm text-slate-500 mt-1">Please check back later.</p>
              {userId && (
                <button
                  onClick={() => {
                    setEditingId(undefined);
                    setEditorOpen(true);
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm"
                >
                  Publish a Course
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                currency={baseCurrency}
                isAppShell={isAppShell}
                onOpen={() => {
                  setSelectedId(course.id);
                  setView("course");
                }}
              />
            ))}
          </div>

          <AcademyRecommendations
            onOpenCourse={(id) => {
              setSelectedId(id);
              setView("course");
            }}
          />
        </div>
      </div>

      {editingId ? (
        <CourseEditorModal
          open={editorOpen}
          courseId={editingId}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      ) : (
        <CoursePublishWizard
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function CourseCard({
  course,
  currency,
  isAppShell,
  onOpen,
}: {
  course: CourseDTO;
  currency: Currency;
  isAppShell: boolean;
  onOpen: () => void;
}) {
  return (
    <div className={`${!isAppShell ? "bg-white border-slate-200 shadow-sm hover:shadow-lg hover:border-emerald-300" : "bg-[#1E1E24] border-white/10 hover:border-emerald-500/40 md:bg-white md:border-slate-200 md:shadow-sm md:hover:shadow-lg md:hover:border-emerald-300"} rounded-xl overflow-hidden transition-all md:hover:-translate-y-0.5`}>
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-video bg-gradient-to-br from-emerald-600/40 to-indigo-700/40 overflow-hidden">
          {course.coverUrl ? (
            <ResponsiveImage
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              src={course.coverUrl}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <GraduationCap className="w-16 h-16 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-black border border-white/20 flex items-center justify-center">
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </span>
          </span>
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/20 rounded px-2 py-1">
              {course.category}
            </span>
            {course.promoted && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/80 text-black rounded px-2 py-1">
                <Sparkles className="w-3 h-3 inline mr-1" /> Featured
              </span>
            )}
          </div>
          <div className="absolute top-3 right-3">
            {course.isFree ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-black rounded px-2 py-1">
                Free
              </span>
            ) : (
              <span className="text-[11px] font-bold bg-black/60 text-white border border-white/20 rounded px-2 py-1">
                {courseDisplayPrice(course, currency).formatted}
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="p-5">
        <h3 className={`${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"} font-black text-lg leading-snug`}>
          {course.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {course.instructorName && <span>By {course.instructorName}</span>}
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> {course.level}
          </span>
        </div>
        {course.description && (
          <p className={`mt-3 text-sm leading-relaxed line-clamp-2 ${!isAppShell ? "text-slate-600" : "text-slate-400 md:text-slate-600"}`}>
            {course.description}
          </p>
        )}

        <button
          onClick={onOpen}
          className="mt-4 w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm inline-flex items-center justify-center gap-2"
        >
          {course.isFree ? "Start learning" : "View course"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CourseDetail({
  courseId,
  userId,
  isAppShell,
  onBack,
  onEdit,
}: {
  courseId: string;
  userId: string | null;
  isAppShell: boolean;
  onBack: () => void;
  onEdit: (id: string) => void;
}) {
  const fetchCourse = useServerFn(getCourse);
  const fetchEnroll = useServerFn(getMyEnrollment);
  const enroll = useServerFn(enrollFree);
  const complete = useServerFn(markModuleComplete);
  const uncomplete = useServerFn(unmarkModuleComplete);
  const { baseCurrency } = useOnboarding();

  const [course, setCourse] = useState<CourseWithModulesDTO | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentDTO | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchCourse({ data: { id: courseId } })
      .then(async (c) => {
        setCourse(c);
        if (userId) {
          try {
            const e = await fetchEnroll({ data: { courseId } });
            setEnrollment(e);
            // Resume: last completed + 1 or 0
            if (e && c.modules.length > 0) {
              const lastDone = c.modules.findIndex((m) => !e.completedModules.includes(m.id));
              setActiveIdx(lastDone === -1 ? c.modules.length - 1 : lastDone);
            }
          } catch {
            /* not enrolled */
          }
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [courseId, userId, fetchCourse, fetchEnroll]);

  if (loading || !course) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
      </div>
    );
  }

  const isOwner = userId && course.ownerId === userId;
  const activeModule: ModuleDTO | undefined = course.modules[activeIdx];
  const canWatch = enrollment || activeModule?.isPreview || isOwner;
  const isDone = activeModule && enrollment?.completedModules.includes(activeModule.id);
  const completedCount = enrollment?.completedModules.length ?? 0;
  const totalModules = course.modules.length;
  const progressPct = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const isComplete = enrollment?.completedAt != null;

  const doEnroll = async () => {
    if (!userId) {
      window.dispatchEvent(
        new CustomEvent("oventric:auth-required", { detail: { tier: 2, kind: "seller" } }),
      );
      return;
    }
    if (!course.isFree) {
      setCheckoutOpen(true);
      return;
    }
    setBusy(true);
    try {
      const e = await enroll({ data: { courseId } });
      setEnrollment(e);
      toast.success("You're enrolled! Start learning below.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const refetchEnrollment = async () => {
    try {
      const e = await fetchEnroll({ data: { courseId } });
      setEnrollment(e);
    } catch {
      /* not enrolled */
    }
  };

  const toggleComplete = async () => {
    if (!activeModule || !enrollment) return;
    setBusy(true);
    try {
      if (isDone) {
        await uncomplete({ data: { courseId, moduleId: activeModule.id } });
        setEnrollment({
          ...enrollment,
          completedModules: enrollment.completedModules.filter((id) => id !== activeModule.id),
          completedAt: null,
        });
      } else {
        const res = await complete({ data: { courseId, moduleId: activeModule.id } });
        setEnrollment({
          ...enrollment,
          completedModules: [...enrollment.completedModules, activeModule.id],
          completedAt: res.completedAt,
        });
        if (res.completedAt) toast.success("🎉 Course complete!");
        // Auto-advance
        if (activeIdx < totalModules - 1) setActiveIdx(activeIdx + 1);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto w-full px-4 py-4 ${!isAppShell ? "bg-white min-h-screen" : "md:bg-white md:min-h-screen"}`}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={onBack}
          className={`inline-flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 border ${!isAppShell ? "text-slate-600 bg-white border-slate-200 hover:text-slate-900" : "text-slate-300 hover:text-white bg-[#1E1E24] border-white/10 md:text-slate-600 md:hover:text-slate-900 md:bg-white md:border-slate-200"}`}
        >
          <ArrowLeft className="w-4 h-4" /> Catalog
        </button>
        {isOwner && (
          <button
            onClick={() => onEdit(course.id)}
            className="ml-auto inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5"
          >
            <Edit3 className="w-4 h-4" /> Edit course
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          <div className={`border rounded-xl overflow-hidden ${!isAppShell ? "bg-white border-slate-200 shadow-sm" : "bg-[#1E1E24] border-white/10 md:bg-white md:border-slate-200 md:shadow-sm"}`}>
            <div className="aspect-video bg-black relative">
              {activeModule && canWatch ? (
                <iframe
                  key={activeModule.id}
                  src={embedUrl(activeModule)}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activeModule.title}
                />
              ) : activeModule ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <Lock className="w-10 h-10 mb-2" />
                  <div className="text-sm">Enroll to unlock this module</div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  <div className="text-sm">No modules yet</div>
                </div>
              )}
            </div>
            <div className="p-5">
              <h1 className={`${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"} font-black text-2xl leading-tight`}>
                {course.title}
              </h1>
              <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                {course.instructorName && <span>By {course.instructorName}</span>}
                <span>{course.category}</span>
                <span>{course.level}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {totalModules} modules
                </span>
              </div>
              {course.description && (
                <p className={`mt-4 text-sm leading-relaxed whitespace-pre-wrap ${!isAppShell ? "text-slate-600" : "text-slate-300 md:text-slate-600"}`}>
                  {course.description}
                </p>
              )}

              {activeModule && (
                <div className={`mt-6 p-4 rounded-lg border ${!isAppShell ? "bg-slate-50 border-slate-200" : "bg-[#121214] border-white/10 md:bg-slate-50 md:border-slate-200"}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${!isAppShell ? "text-emerald-600" : "text-emerald-300 md:text-emerald-600"}`}>
                    Module {activeIdx + 1} of {totalModules}
                  </div>
                  <div className={`${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"} font-bold`}>{activeModule.title}</div>
                  {activeModule.description && (
                    <p className={`text-sm mt-2 ${!isAppShell ? "text-slate-600" : "text-slate-400 md:text-slate-600"}`}>
                      {activeModule.description}
                    </p>
                  )}
                  {enrollment && (
                    <button
                      onClick={toggleComplete}
                      disabled={busy}
                      className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${
                        isDone
                          ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-300"
                          : "bg-emerald-500 hover:bg-emerald-400 text-black"
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      {isDone ? "Completed — mark undone" : "Mark as complete"}
                    </button>
                  )}
                </div>
              )}

              {isComplete && (
                <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/40 flex items-start gap-3">
                  <Award className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-emerald-200 font-bold">Course complete! 🎉</div>
                    <div className="text-xs text-emerald-300/80 mt-1">
                      Digital certificate generation is coming soon. Your progress is saved.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {!enrollment && !isOwner && (
            <button
              onClick={doEnroll}
              disabled={busy}
              className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {course.isFree
                ? "Enroll for free"
                : `Enroll · ${courseDisplayPrice(course, baseCurrency).formatted}`}
            </button>
          )}

          {enrollment && (
            <div className={`p-4 rounded-lg border ${!isAppShell ? "bg-white border-slate-200 shadow-sm" : "bg-[#1E1E24] border-white/10 md:bg-white md:border-slate-200 md:shadow-sm"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${!isAppShell ? "text-slate-500" : "text-slate-400 md:text-slate-500"}`}>
                  Your Progress
                </span>
                <span className={`text-xs font-bold ${!isAppShell ? "text-emerald-600" : "text-emerald-300 md:text-emerald-600"}`}>
                  {progressPct}%
                </span>
              </div>
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${!isAppShell ? "bg-slate-200" : "bg-white/5 md:bg-slate-200"}`}>
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {completedCount} of {totalModules} modules complete
              </div>
            </div>
          )}

          <div className={`border rounded-xl overflow-hidden ${!isAppShell ? "bg-white border-slate-200 shadow-sm" : "bg-[#1E1E24] border-white/10 md:bg-white md:border-slate-200 md:shadow-sm"}`}>
            <div className={`px-4 py-3 border-b text-xs font-bold uppercase tracking-wider ${!isAppShell ? "border-slate-200 text-slate-500" : "border-white/10 md:border-slate-200 text-slate-400 md:text-slate-500"}`}>
              Curriculum
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {course.modules.map((m, i) => {
                const done = enrollment?.completedModules.includes(m.id);
                const locked = !enrollment && !m.isPreview && !isOwner;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveIdx(i)}
                    className={`w-full text-left px-4 py-3 border-b flex items-start gap-3 transition-colors ${
                      i === activeIdx
                        ? !isAppShell
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-emerald-500/10 md:bg-emerald-50"
                        : !isAppShell
                          ? "hover:bg-slate-50 border-slate-100"
                          : "hover:bg-white/5 border-white/5 md:hover:bg-slate-50 md:border-slate-100"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : locked ? (
                      <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"}`}>
                        {m.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {m.durationMin > 0 ? `${m.durationMin} min · ` : ""}
                        {m.videoProvider}
                        {m.isPreview && !enrollment && " · preview"}
                      </div>
                    </div>
                  </button>
                );
              })}
              {course.modules.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">No modules yet</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <CourseCheckoutModal
        open={checkoutOpen}
        course={
          course
            ? {
                id: course.id,
                title: course.title,
                instructorName: course.instructorName,
                priceUSD: course.priceUSD,
                coverUrl: course.coverUrl,
                originalCurrency: course.originalCurrency,
                originalAmount: course.originalAmount,
                fxSnapshot: course.fxSnapshot,
              }
            : null
        }
        onClose={() => setCheckoutOpen(false)}
        onEnrolled={() => {
          setCheckoutOpen(false);
          refetchEnrollment();
        }}
      />
    </div>
  );
}

function AcademyHero({ isAppShell }: { isAppShell: boolean }) {
  return (
    <div className={`relative overflow-hidden border-b ${!isAppShell ? "bg-white border-slate-200" : "bg-[#0A0A0B] border-white/5 md:border-slate-200 md:bg-gradient-to-b md:from-slate-50 md:to-white"}`}>
      <div className="max-w-6xl mx-auto w-full px-4 py-10 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide mb-6 border ${!isAppShell ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white/5 border-white/10 text-slate-200 md:bg-emerald-50 md:border-emerald-200 md:text-emerald-700"}`}>
              <Sparkles className="w-3.5 h-3.5" /> OVENTRIC ACADEMY
            </div>
            <h1 className={`text-3xl sm:text-4xl md:text-5xl font-black leading-[1.08] tracking-tight ${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"}`}>
              Master High-End Digital Skills.
              <br />
              <span className={`${!isAppShell ? "text-slate-500" : "text-slate-400 md:text-slate-500"}`}>
                Learn From Real Builders.
              </span>{" "}
              <span className={`${!isAppShell ? "text-emerald-600" : "text-white md:text-emerald-600"}`}>Earn Certificates.</span>
            </h1>
            <p className={`mt-5 text-base md:text-lg leading-relaxed max-w-xl ${!isAppShell ? "text-slate-600" : "text-slate-400 md:text-slate-600"}`}>
              Video-first courses from working practitioners. Track your progress across sessions,
              resume any time, and earn a certificate when you complete a course.
            </p>
            <div className="mt-7 flex flex-wrap gap-6">
              <HeroStat isAppShell={isAppShell} value="100%" label="Online & self-paced" />
              <HeroStat isAppShell={isAppShell} value="Free" label="Courses available" />
              <HeroStat isAppShell={isAppShell} value="Certificate" label="On completion" />
            </div>
          </div>
          <div className="grid gap-3">
            <ValueCard
              isAppShell={isAppShell}
              Icon={Video}
              title="Video-First Delivery"
              body="Every module is a hosted video. Press play and learn — no downloads, no plugins."
            />
            <ValueCard
              isAppShell={isAppShell}
              Icon={RotateCcw}
              title="Auto-Resume"
              body="Your progress is saved per module. Pick up exactly where you left off."
            />
            <ValueCard
              isAppShell={isAppShell}
              Icon={ScrollText}
              title="Certificate on Completion"
              body="Finish every module and generate a signed digital certificate."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ isAppShell, value, label }: { isAppShell: boolean; value: string; label: string }) {
  return (
    <div>
      <div className={`text-xl font-black ${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ValueCard({
  isAppShell,
  Icon,
  title,
  body,
}: {
  isAppShell: boolean;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className={`p-4 rounded-xl border transition-all ${!isAppShell ? "bg-white border-slate-200 shadow-sm hover:shadow-md" : "bg-white/5 border-white/10 md:bg-white md:border-slate-200 md:shadow-sm md:hover:shadow-md"} flex gap-4`}>
      <div className={`w-11 h-11 shrink-0 rounded-lg border flex items-center justify-center ${!isAppShell ? "bg-emerald-50 border-emerald-100" : "bg-white/5 border-white/10 md:bg-emerald-50 md:border-emerald-100"}`}>
        <Icon className={`w-5 h-5 ${!isAppShell ? "text-emerald-600" : "text-white md:text-emerald-600"}`} />
      </div>
      <div className="min-w-0">
        <h3 className={`font-bold text-base mb-1 ${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"}`}>{title}</h3>
        <p className={`text-sm leading-relaxed ${!isAppShell ? "text-slate-600" : "text-slate-400 md:text-slate-600"}`}>{body}</p>
      </div>
    </div>
  );
}
