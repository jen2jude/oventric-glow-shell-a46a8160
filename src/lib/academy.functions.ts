import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type CourseCategory = "frontend" | "uiux" | "ai" | "backend" | "security";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type VideoProvider = "youtube" | "vimeo";

export type CourseCurrency = "USD" | "NGN" | "GHS";
export type CourseFxSnapshot = {
  base: string;
  rates: Record<string, number>;
  source?: string;
  fetched_at?: string;
} | null;

export interface CourseDTO {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  description: string;
  category: CourseCategory;
  level: CourseLevel;
  instructorName: string;
  coverPath: string | null;
  coverUrl: string | null;
  priceUSD: number;
  isFree: boolean;
  isPublished: boolean;
  promoted: boolean;
  createdAt: string;
  originalCurrency: CourseCurrency;
  originalAmount: number;
  fxSnapshot: CourseFxSnapshot;
  moduleCount?: number;
  enrolledCount?: number;
}

export interface ModuleDTO {
  id: string;
  courseId: string;
  position: number;
  title: string;
  description: string;
  videoUrl: string;
  videoProvider: VideoProvider;
  durationMin: number;
  isPreview: boolean;
}

export interface CourseWithModulesDTO extends CourseDTO {
  modules: ModuleDTO[];
}

export interface EnrollmentDTO {
  id: string;
  courseId: string;
  createdAt: string;
  completedAt: string | null;
  completedModules: string[];
}

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "course"
  );
}

function mapCourse(r: Record<string, unknown>, coverUrl: string | null = null): CourseDTO {
  const priceUSD = Number(r.price_usd ?? 0);
  const originalCurrency = ((r.original_currency as string) ?? "USD") as CourseCurrency;
  const originalAmount = Number(r.original_amount ?? priceUSD);
  const fxSnapshot = (r.fx_snapshot as CourseFxSnapshot) ?? null;
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    title: r.title as string,
    slug: r.slug as string,
    description: (r.description as string) ?? "",
    category: (r.category as CourseCategory) ?? "frontend",
    level: (r.level as CourseLevel) ?? "beginner",
    instructorName: (r.instructor_name as string) ?? "",
    coverPath: (r.cover_path as string) ?? null,
    coverUrl,
    priceUSD,
    isFree: Boolean(r.is_free),
    isPublished: Boolean(r.is_published),
    promoted: Boolean(r.promoted),
    createdAt: r.created_at as string,
    originalCurrency,
    originalAmount,
    fxSnapshot,
  };
}

function mapModule(r: Record<string, unknown>): ModuleDTO {
  return {
    id: r.id as string,
    courseId: r.course_id as string,
    position: Number(r.position ?? 0),
    title: r.title as string,
    description: (r.description as string) ?? "",
    videoUrl: r.video_url as string,
    videoProvider: ((r.video_provider as string) ?? "youtube") as VideoProvider,
    durationMin: Number(r.duration_min ?? 0),
    isPreview: Boolean(r.is_preview),
  };
}

async function signCovers(
  sb: ReturnType<typeof serverPublicClient>,
  paths: (string | null)[],
): Promise<(string | null)[]> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return paths.map(() => null);
  const { data } = await sb.storage.from("course-covers").createSignedUrls(unique, 60 * 60 * 24 * 7);
  const map = new Map<string, string>();
  (data ?? []).forEach((r) => {
    if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  });
  return paths.map((p) => (p ? map.get(p) ?? null : null));
}

const COURSE_COLS =
  "id, owner_id, title, slug, description, category, level, instructor_name, cover_path, price_usd, is_free, is_published, promoted, created_at";

// ---------- PUBLIC LISTINGS ----------

export const listCourses = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublicClient();
  const { data, error } = await sb
    .from("courses")
    .select(COURSE_COLS)
    .eq("is_published", true)
    .order("promoted", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const urls = await signCovers(sb, rows.map((r) => (r.cover_path as string) ?? null));
  return rows.map((r, i) => mapCourse(r as Record<string, unknown>, urls[i]));
});

export const getCourse = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data }): Promise<CourseWithModulesDTO> => {
    if (!data.id) throw new Error("Course id required");
    const sb = serverPublicClient();
    const { data: row, error } = await sb
      .from("courses")
      .select(COURSE_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Course not found");
    const [coverUrl] = await signCovers(sb, [(row.cover_path as string) ?? null]);
    const { data: mods, error: mErr } = await sb
      .from("course_modules")
      .select("id, course_id, position, title, description, video_url, video_provider, duration_min, is_preview")
      .eq("course_id", data.id)
      .order("position", { ascending: true });
    if (mErr) throw new Error(mErr.message);
    return {
      ...mapCourse(row as Record<string, unknown>, coverUrl),
      modules: (mods ?? []).map((m) => mapModule(m as Record<string, unknown>)),
    };
  });

// ---------- COURSE CRUD (owner or admin) ----------

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    title: string;
    description?: string;
    category?: CourseCategory;
    level?: CourseLevel;
    instructorName?: string;
    coverPath?: string | null;
    priceUSD?: number;
    isFree?: boolean;
    isPublished?: boolean;
    promoted?: boolean;
  }) => ({
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    category: (input.category ?? "frontend") as CourseCategory,
    level: (input.level ?? "beginner") as CourseLevel,
    instructorName: String(input.instructorName ?? "").trim(),
    coverPath: input.coverPath ?? null,
    priceUSD: Number(input.priceUSD ?? 0),
    isFree: input.isFree ?? true,
    isPublished: input.isPublished ?? true,
    promoted: Boolean(input.promoted),
  }))
  .handler(async ({ data, context }) => {
    if (!data.title) throw new Error("Title required");
    if (!data.isFree && !(data.priceUSD > 0)) throw new Error("Paid courses need a price > 0");
    const base = slugify(data.title);
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: row, error } = await context.supabase
      .from("courses")
      .insert({
        owner_id: context.userId,
        title: data.title,
        slug,
        description: data.description,
        category: data.category,
        level: data.level,
        instructor_name: data.instructorName || null,
        cover_path: data.coverPath,
        price_usd: data.isFree ? 0 : data.priceUSD,
        is_free: data.isFree,
        is_published: data.isPublished,
        promoted: data.promoted,
      })
      .select(COURSE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return mapCourse(row as Record<string, unknown>, null);
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    title?: string;
    description?: string;
    category?: CourseCategory;
    level?: CourseLevel;
    instructorName?: string;
    coverPath?: string | null;
    priceUSD?: number;
    isFree?: boolean;
    isPublished?: boolean;
    promoted?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    if (!data.id) throw new Error("Course id required");
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.category !== undefined) patch.category = data.category;
    if (data.level !== undefined) patch.level = data.level;
    if (data.instructorName !== undefined) patch.instructor_name = data.instructorName;
    if (data.coverPath !== undefined) patch.cover_path = data.coverPath;
    if (data.priceUSD !== undefined) patch.price_usd = data.priceUSD;
    if (data.isFree !== undefined) patch.is_free = data.isFree;
    if (data.isPublished !== undefined) patch.is_published = data.isPublished;
    if (data.promoted !== undefined) patch.promoted = data.promoted;
    const { data: row, error } = await context.supabase
      .from("courses")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id)
      .select(COURSE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return mapCourse(row as Record<string, unknown>, null);
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- MODULES ----------

export const upsertModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    courseId: string;
    position: number;
    title: string;
    description?: string;
    videoUrl: string;
    videoProvider?: VideoProvider;
    durationMin?: number;
    isPreview?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    if (!data.courseId) throw new Error("Course id required");
    if (!data.title?.trim()) throw new Error("Module title required");
    if (!data.videoUrl?.trim()) throw new Error("Video URL required");
    const row = {
      course_id: data.courseId,
      position: data.position ?? 0,
      title: data.title.trim(),
      description: (data.description ?? "").trim(),
      video_url: data.videoUrl.trim(),
      video_provider: (data.videoProvider ?? "youtube") as VideoProvider,
      duration_min: data.durationMin ?? 0,
      is_preview: Boolean(data.isPreview),
    };
    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("course_modules")
        .update(row)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapModule(updated as Record<string, unknown>);
    }
    const { data: created, error } = await context.supabase
      .from("course_modules")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapModule(created as Record<string, unknown>);
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("course_modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- ENROLLMENT & PROGRESS ----------

export const enrollFree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(async ({ data, context }): Promise<EnrollmentDTO> => {
    const { data: course, error: cErr } = await context.supabase
      .from("courses")
      .select("id, is_free, is_published")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course) throw new Error("Course not found");
    if (!course.is_free) throw new Error("Paid enrollment is not yet available");
    if (!course.is_published) throw new Error("Course is not published");

    const { data: row, error } = await context.supabase
      .from("course_enrollments")
      .upsert(
        {
          user_id: context.userId,
          course_id: data.courseId,
          amount_paid_usd: 0,
        },
        { onConflict: "user_id,course_id", ignoreDuplicates: false },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id as string,
      courseId: row.course_id as string,
      createdAt: row.created_at as string,
      completedAt: (row.completed_at as string) ?? null,
      completedModules: [],
    };
  });

export const getMyEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(async ({ data, context }): Promise<EnrollmentDTO | null> => {
    const { data: row, error } = await context.supabase
      .from("course_enrollments")
      .select("id, course_id, created_at, completed_at")
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const { data: prog } = await context.supabase
      .from("course_progress")
      .select("module_id")
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId);
    return {
      id: row.id as string,
      courseId: row.course_id as string,
      createdAt: row.created_at as string,
      completedAt: (row.completed_at as string) ?? null,
      completedModules: (prog ?? []).map((p) => p.module_id as string),
    };
  });

export const listMyEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data, error } = await sb
      .from("course_enrollments")
      .select("id, course_id, created_at, completed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      courseId: r.course_id as string,
      createdAt: r.created_at as string,
      completedAt: (r.completed_at as string) ?? null,
    }));
  });

export const markModuleComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; moduleId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // Insert progress (ignore duplicate)
    const { error } = await sb.from("course_progress").upsert(
      {
        user_id: context.userId,
        course_id: data.courseId,
        module_id: data.moduleId,
      },
      { onConflict: "user_id,module_id", ignoreDuplicates: true },
    );
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw new Error(error.message);

    // Check completion
    const [{ data: allMods }, { data: doneMods }] = await Promise.all([
      sb.from("course_modules").select("id").eq("course_id", data.courseId),
      sb.from("course_progress").select("module_id").eq("user_id", context.userId).eq("course_id", data.courseId),
    ]);
    const total = (allMods ?? []).length;
    const done = (doneMods ?? []).length;
    let completedAt: string | null = null;
    if (total > 0 && done >= total) {
      const { data: updated } = await sb
        .from("course_enrollments")
        .update({ completed_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("course_id", data.courseId)
        .is("completed_at", null)
        .select("completed_at")
        .maybeSingle();
      completedAt = (updated?.completed_at as string) ?? null;
    }
    return { total, done, completedAt };
  });

export const unmarkModuleComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; moduleId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("course_progress")
      .delete()
      .eq("user_id", context.userId)
      .eq("module_id", data.moduleId);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("course_enrollments")
      .update({ completed_at: null })
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId);
    return { ok: true };
  });

// ---------- OWNER / ADMIN LISTS ----------

export const listMyCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("courses")
      .select(COURSE_COLS)
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapCourse(r as Record<string, unknown>, null));
  });

export const adminListCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await sb
      .from("courses")
      .select(COURSE_COLS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => mapCourse(r, null));
  });

// ---------- UPLOAD HELPER ----------

/** Returns a signed upload URL for a cover in course-covers/<uid>/<filename>. */
export const getCourseCoverUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filename: string }) => ({ filename: String(input.filename) }))
  .handler(async ({ data, context }) => {
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${context.userId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("course-covers")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const getCourseCoverViewUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string }) => ({ path: String(input.path) }))
  .handler(async ({ data }) => {
    if (!data.path) return { url: null };
    const sb = serverPublicClient();
    const { data: signed } = await sb.storage
      .from("course-covers")
      .createSignedUrl(data.path, 60 * 60 * 24 * 7);
    return { url: signed?.signedUrl ?? null };
  });

// ---------- PAID ENROLLMENT ----------

export type EnrollCurrency = "USD" | "NGN" | "GHS";
export type EnrollPaymentMethod = "wallet" | "card" | "bank_transfer" | "mobile_money";

export const FX_FROM_USD_ACADEMY: Record<EnrollCurrency, number> = { USD: 1, NGN: 1500, GHS: 14 };
export const INSTRUCTOR_SHARE = 0.8;
export const PLATFORM_ACADEMY_SHARE = 0.2;
export const WALLET_CASHBACK_PCT_ACADEMY = 0.02;

export interface EnrollPaidInput {
  courseId: string;
  displayCurrency: EnrollCurrency;
  paymentMethod: EnrollPaymentMethod;
  couponCode?: string | null;
}

export interface EnrollPaidResult {
  enrollment: EnrollmentDTO | null;
  totalUSD: number;
  displayTotal: number;
  displayCurrency: EnrollCurrency;
  discountUSD?: number;
  cashbackUSD?: number;
  walletShortfallUSD?: number;
}

export const enrollPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnrollPaidInput) => ({
    courseId: String(input.courseId ?? ""),
    displayCurrency: (input.displayCurrency ?? "USD") as EnrollCurrency,
    paymentMethod: (input.paymentMethod ?? "wallet") as EnrollPaymentMethod,
    couponCode: input.couponCode ? String(input.couponCode).trim().toUpperCase() : null,
  }))
  .handler(async ({ data, context }): Promise<EnrollPaidResult> => {
    const { supabase, userId } = context;
    if (!data.courseId) throw new Error("Course id required");

    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, owner_id, price_usd, is_free, is_published")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course) throw new Error("Course not found");
    if (!course.is_published) throw new Error("Course is not published");
    if (course.is_free) throw new Error("Course is free — use enrollFree");
    if ((course.owner_id as string) === userId) throw new Error("You already own this course");

    // Already enrolled?
    const { data: existing } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    if (existing) throw new Error("You're already enrolled in this course");

    const grossUSD = Number(Number(course.price_usd).toFixed(2));

    // Coupon only for non-wallet payments (matches marketplace policy).
    let discountUSD = 0;
    if (data.couponCode && data.paymentMethod !== "wallet") {
      const { data: c } = await supabase
        .from("coupons")
        .select("discount_pct")
        .eq("code", data.couponCode)
        .eq("active", true)
        .maybeSingle();
      if (c) {
        const pct = Number(c.discount_pct);
        discountUSD = Number(((grossUSD * pct) / 100).toFixed(2));
      }
    }
    const totalUSD = Number((grossUSD - discountUSD).toFixed(2));
    const fx = FX_FROM_USD_ACADEMY[data.displayCurrency];
    const displayTotal = Number((totalUSD * fx).toFixed(2));

    // Wallet debit path — wallet mutations always run via service-role client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.paymentMethod === "wallet") {
      const { data: ok, error: dErr } = await supabaseAdmin.rpc("wallet_debit", {
        _user_id: userId,
        _amount: totalUSD,
      });
      if (dErr) throw new Error(dErr.message);
      if (!ok) {
        const { data: w } = await supabase
          .from("wallets")
          .select("available_balance")
          .eq("user_id", userId)
          .eq("currency", "USD")
          .maybeSingle();
        const bal = Number(w?.available_balance ?? 0);
        return {
          enrollment: null,
          totalUSD,
          displayTotal,
          displayCurrency: data.displayCurrency,
          walletShortfallUSD: Number((totalUSD - bal).toFixed(2)),
        };
      }
    }

    // Insert enrollment
    const { data: eRow, error: eErr } = await supabase
      .from("course_enrollments")
      .insert({
        user_id: userId,
        course_id: data.courseId,
        amount_paid_usd: totalUSD,
        payment_method: data.paymentMethod,
        display_currency: data.displayCurrency,
        display_total: displayTotal,
        coupon_code: data.couponCode,
        discount_usd: discountUSD,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (eErr) throw new Error(eErr.message);

    // Buyer wallet ledger
    await supabase.from("wallet_transactions").insert({
      user_id: userId,
      tx_hash: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`,
      type: "Marketplace Purchase",
      amount: displayTotal,
      currency: data.displayCurrency,
      inflow: false,
      status: "success",
      occurred_at: new Date().toISOString(),
    });

    // 80/20 split — instructor gets 80%, platform academy wallet gets 20%.
    const instructorCutUSD = Number((totalUSD * INSTRUCTOR_SHARE).toFixed(2));
    const platformCutUSD = Number((totalUSD - instructorCutUSD).toFixed(2));

    await supabaseAdmin.rpc("wallet_credit", {
      _user_id: course.owner_id as string,
      _amount: instructorCutUSD,
    });

    await supabaseAdmin.rpc("system_wallet_credit", {
      _kind: "academy",
      _amount: platformCutUSD,
      _source: "course_enrollment",
      _ref: eRow.id as string,
      _meta: {
        enrollment_id: eRow.id,
        course_id: data.courseId,
        buyer_id: userId,
        instructor_id: course.owner_id,
      },
    });

    // 2% cashback for wallet payments
    let cashbackUSD = 0;
    if (data.paymentMethod === "wallet") {
      cashbackUSD = Number((totalUSD * WALLET_CASHBACK_PCT_ACADEMY).toFixed(2));
      if (cashbackUSD > 0) {
        await supabaseAdmin.rpc("wallet_credit", { _user_id: userId, _amount: cashbackUSD });
        await supabase.from("wallet_transactions").insert({
          user_id: userId,
          tx_hash: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`,
          type: "Affiliate Cashback Payout",
          amount: Number((cashbackUSD * fx).toFixed(2)),
          currency: data.displayCurrency,
          inflow: true,
          status: "success",
          occurred_at: new Date().toISOString(),
        });
        await supabase
          .from("course_enrollments")
          .update({ cashback_usd: cashbackUSD })
          .eq("id", eRow.id);
      }
    }

    return {
      enrollment: {
        id: eRow.id as string,
        courseId: eRow.course_id as string,
        createdAt: eRow.created_at as string,
        completedAt: null,
        completedModules: [],
      },
      totalUSD,
      displayTotal,
      displayCurrency: data.displayCurrency,
      discountUSD: discountUSD || undefined,
      cashbackUSD: cashbackUSD || undefined,
    };
  });
