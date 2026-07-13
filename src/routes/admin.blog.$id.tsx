import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered,
  Link2, Image as ImageIcon, Quote, Code, Loader2, ArrowLeft, Save, X, Plus, Strikethrough, Undo, Redo,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import {
  getBlogAdmin, upsertBlogPost, upsertBlogCategory, upsertBlogTag,
  listBlogCategories, listBlogTags,
} from "@/lib/blog.functions";

export const Route = createFileRoute("/admin/blog/$id")({
  head: () => ({ meta: [{ title: "Edit blog · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: BlogEditorPage,
});

type Status = "draft" | "published" | "scheduled";

function BlogEditorPage() {
  const { id: routeId } = useParams({ from: "/admin/blog/$id" });
  const isNew = routeId === "new";
  const navigate = useNavigate();

  const getFn = useServerFn(getBlogAdmin);
  const upsertFn = useServerFn(upsertBlogPost);
  const catFn = useServerFn(listBlogCategories);
  const tagFn = useServerFn(listBlogTags);
  const newCatFn = useServerFn(upsertBlogCategory);
  const newTagFn = useServerFn(upsertBlogTag);

  const [id, setId] = useState<string | undefined>(isNew ? undefined : routeId);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("draft");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const [c, t] = await Promise.all([catFn(), tagFn()]);
      setCategories(c.categories as any);
      setTags(t.tags as any);
    })();
  }, [catFn, tagFn]);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const res = await getFn({ data: { id: routeId } });
      const p: any = res.post;
      setId(p.id);
      setTitle(p.title);
      setSlug(p.slug);
      setExcerpt(p.excerpt ?? "");
      setCoverPath(p.cover_path ?? null);
      setCoverUrl(p.cover_url ?? null);
      setStatus(p.status);
      setScheduledAt(p.scheduled_at ? new Date(p.scheduled_at).toISOString().slice(0, 16) : "");
      setCategoryId(p.category_id ?? null);
      setTagIds(p.tag_ids ?? []);
      if (editorRef.current) editorRef.current.innerHTML = p.body_html ?? "";
      setLoading(false);
    })();
  }, [isNew, routeId, getFn]);

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
  };
  const setBlock = (tag: string) => exec("formatBlock", tag);

  const insertLink = () => {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    exec("createLink", url);
  };

  const uploadFileToBucket = async (file: File): Promise<{ path: string; url: string }> => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw new Error("Not signed in");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("blog-covers").upload(path, file, {
      contentType: file.type, cacheControl: "3600", upsert: false,
    });
    if (error) throw error;
    const { data: signed, error: sErr } = await supabase.storage.from("blog-covers").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr || !signed) throw sErr ?? new Error("Sign failed");
    return { path, url: signed.signedUrl };
  };

  const onCoverPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const { path, url } = await uploadFileToBucket(f);
      setCoverPath(path);
      setCoverUrl(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const onImagePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const { url } = await uploadFileToBucket(f);
      exec("insertHTML", `<p><img src="${url}" alt="" style="max-width:100%;border-radius:8px" /></p>`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const addCategory = async () => {
    const n = newCat.trim();
    if (!n) return;
    const r = await newCatFn({ data: { name: n } });
    setCategories((prev) => [...prev.filter((c) => c.id !== r.id), r as any].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId(r.id);
    setNewCat("");
  };

  const addTag = async () => {
    const n = newTag.trim();
    if (!n) return;
    const r = await newTagFn({ data: { name: n } });
    setTags((prev) => prev.some((t) => t.id === r.id) ? prev : [...prev, r as any]);
    setTagIds((prev) => prev.includes(r.id) ? prev : [...prev, r.id]);
    setNewTag("");
  };

  const save = async (finalStatus?: Status) => {
    const s = finalStatus ?? status;
    if (!title.trim()) return alert("Title is required.");
    const body_html = editorRef.current?.innerHTML ?? "";
    setSaving(true);
    try {
      const res = await upsertFn({
        data: {
          id,
          title: title.trim(),
          slug: slug.trim() || undefined,
          excerpt: excerpt.trim() || undefined,
          body_html,
          cover_path: coverPath,
          category_id: categoryId,
          status: s,
          scheduled_at: s === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          tag_ids: tagIds,
        },
      });
      setId(res.id);
      setStatus(s);
      alert(s === "published" ? "Published!" : s === "scheduled" ? "Scheduled." : "Draft saved.");
      if (isNew) navigate({ to: "/admin/blog/$id", params: { id: res.id } });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const btn = "p-2 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition";

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/blog" className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
            {isNew ? "New post" : "Edit post"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm inline-flex items-center gap-1"
          >
            <Save className="w-4 h-4" /> Save draft
          </button>
          <button
            onClick={() => save("scheduled")}
            disabled={saving || !scheduledAt}
            className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm disabled:opacity-40"
          >
            Schedule
          </button>
          <button
            onClick={() => save("published")}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold inline-flex items-center gap-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Publish
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="w-full bg-transparent border-b border-white/10 pb-3 text-white text-3xl font-black placeholder:text-slate-600 focus:outline-none"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="url-slug (auto-generated if empty)"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono"
          />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 bg-[#141418] border border-white/10 rounded-t-lg p-1 sticky top-0 z-10">
            <button className={btn} onClick={() => setBlock("h1")} title="Heading 1"><Heading1 className="w-4 h-4" /></button>
            <button className={btn} onClick={() => setBlock("h2")} title="Heading 2"><Heading2 className="w-4 h-4" /></button>
            <button className={btn} onClick={() => setBlock("h3")} title="Heading 3"><Heading3 className="w-4 h-4" /></button>
            <button className={btn} onClick={() => setBlock("p")} title="Paragraph"><span className="text-xs font-bold px-1">P</span></button>
            <span className="w-px h-5 bg-white/10 mx-1" />
            <button className={btn} onClick={() => exec("bold")} title="Bold"><Bold className="w-4 h-4" /></button>
            <button className={btn} onClick={() => exec("italic")} title="Italic"><Italic className="w-4 h-4" /></button>
            <button className={btn} onClick={() => exec("underline")} title="Underline"><UnderlineIcon className="w-4 h-4" /></button>
            <button className={btn} onClick={() => exec("strikeThrough")} title="Strike"><Strikethrough className="w-4 h-4" /></button>
            <span className="w-px h-5 bg-white/10 mx-1" />
            <button className={btn} onClick={() => exec("insertUnorderedList")} title="Bullets"><List className="w-4 h-4" /></button>
            <button className={btn} onClick={() => exec("insertOrderedList")} title="Numbered"><ListOrdered className="w-4 h-4" /></button>
            <button className={btn} onClick={() => setBlock("blockquote")} title="Quote"><Quote className="w-4 h-4" /></button>
            <button className={btn} onClick={() => setBlock("pre")} title="Code block"><Code className="w-4 h-4" /></button>
            <span className="w-px h-5 bg-white/10 mx-1" />
            <button className={btn} onClick={insertLink} title="Link"><Link2 className="w-4 h-4" /></button>
            <button className={btn} onClick={() => imageInputRef.current?.click()} title="Insert image"><ImageIcon className="w-4 h-4" /></button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onImagePicked} />
            <span className="w-px h-5 bg-white/10 mx-1" />
            <button className={btn} onClick={() => exec("undo")} title="Undo"><Undo className="w-4 h-4" /></button>
            <button className={btn} onClick={() => exec("redo")} title="Redo"><Redo className="w-4 h-4" /></button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="prose-editor min-h-[420px] bg-[#141418] border border-white/10 border-t-0 rounded-b-lg px-5 py-4 text-slate-200 leading-relaxed focus:outline-none"
            style={{ minHeight: 420 }}
          />

          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            placeholder="Excerpt (optional — auto-derived if empty)"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200"
          />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <section className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <h3 className="text-white text-sm font-bold mb-2">Cover image</h3>
            {coverUrl ? (
              <div className="relative">
                <ResponsiveImage sizes="(min-width: 768px) 640px, 100vw" src={coverUrl} alt="" className="w-full aspect-video rounded-lg object-cover" />
                <button
                  onClick={() => { setCoverPath(null); setCoverUrl(null); }}
                  className="absolute top-2 right-2 p-1 rounded-md bg-black/70 text-white"
                ><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => coverInputRef.current?.click()}
                className="w-full aspect-video rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-slate-500 hover:text-white hover:border-white/40 text-xs"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ImageIcon className="w-5 h-5 mb-1" />Upload cover</>}
              </button>
            )}
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverPicked} />
          </section>

          <section className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <h3 className="text-white text-sm font-bold mb-2">Status</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(["draft", "published", "scheduled"] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-2 rounded-lg border capitalize ${status === s ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "border-white/10 text-slate-400 hover:text-white"}`}
                >{s}</button>
              ))}
            </div>
            {status === "scheduled" && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2 w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
              />
            )}
          </section>

          <section className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <h3 className="text-white text-sm font-bold mb-2">Category</h3>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
            >
              <option value="">— none —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="mt-2 flex gap-1">
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Add new category"
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
              />
              <button onClick={addCategory} className="px-2 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs"><Plus className="w-3 h-3" /></button>
            </div>
          </section>

          <section className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <h3 className="text-white text-sm font-bold mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => setTagIds((prev) => on ? prev.filter((x) => x !== t.id) : [...prev, t.id])}
                    className={`text-[10px] px-2 py-1 rounded-full border ${on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "border-white/10 text-slate-400 hover:text-white"}`}
                  >{t.name}</button>
                );
              })}
              {tags.length === 0 && <span className="text-xs text-slate-500">No tags yet.</span>}
            </div>
            <div className="flex gap-1">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add new tag"
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
              />
              <button onClick={addTag} className="px-2 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs"><Plus className="w-3 h-3" /></button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
