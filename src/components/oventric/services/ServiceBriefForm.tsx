/**
 * Buyer intake brief shown at checkout for service listings. Capturing scope
 * up front is what removes the long back-and-forth after payment, so the
 * seller can start the moment the order lands.
 */
export const BRIEF_FIELDS = [
  {
    key: "goal" as const,
    label: "What do you need done?",
    placeholder: "e.g. A 5-screen mobile app UI for a delivery service, light + dark themes.",
    required: true,
    rows: 3,
  },
  {
    key: "timeline" as const,
    label: "When do you need it?",
    placeholder: "e.g. First drafts within a week, final files by the 30th.",
    required: true,
    rows: 2,
  },
  {
    key: "audience" as const,
    label: "Who is it for? (optional)",
    placeholder: "Your business, audience, or the style you're going for.",
    required: false,
    rows: 2,
  },
  {
    key: "references" as const,
    label: "Links or references (optional)",
    placeholder: "Brand kit, docs, examples you like…",
    required: false,
    rows: 2,
  },
];

export type BriefState = Record<(typeof BRIEF_FIELDS)[number]["key"], string>;

export function ServiceBriefForm({
  value,
  onChange,
  dark,
}: {
  value: BriefState;
  onChange: (next: BriefState) => void;
  dark: boolean;
}) {
  return (
    <div
      className={`mt-2 rounded-xl border p-4 ${
        dark ? "border-white/5 bg-[#16161A]" : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div
        className={`text-xs font-bold uppercase tracking-widest mb-1 ${dark ? "text-slate-400" : "text-slate-600"}`}
      >
        Project brief
      </div>
      <p className={`text-[11px] mb-3 ${dark ? "text-slate-500" : "text-slate-600"}`}>
        The seller sees this the moment you pay, so work can start without a back-and-forth.
      </p>
      {BRIEF_FIELDS.map((f) => (
        <label key={f.key} className="mb-3 block">
          <span className={`text-xs ${dark ? "text-slate-300" : "text-slate-700 font-medium"}`}>
            {f.label}
          </span>
          <textarea
            rows={f.rows}
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            maxLength={1200}
            placeholder={f.placeholder}
            className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-500/60 ${
              dark
                ? "border-white/10 bg-[#0A0A0B] text-white"
                : "border-slate-200 bg-slate-50 text-slate-900"
            }`}
          />
          {f.required && value[f.key].trim().length > 0 && value[f.key].trim().length < 10 && (
            <span className="mt-1 block text-[11px] text-red-300">
              Add a little more detail (10+ characters).
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
