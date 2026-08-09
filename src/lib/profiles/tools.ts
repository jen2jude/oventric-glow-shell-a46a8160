/**
 * Tools catalogue for the profile "Tools I Use" showcase.
 *
 * Logos are not uploaded by users — each tool is stored as a stable slug and
 * rendered from the Simple Icons CDN (brand SVG, official brand colour), so a
 * picked tool always has a crisp logo with zero storage cost.
 */

export interface ToolDef {
  /** Stable slug persisted on the profile. */
  id: string;
  label: string;
  /** Simple Icons slug (defaults to `id`). */
  icon?: string;
  /** Brand colour override — Simple Icons defaults to the official one. */
  color?: string;
  group: string;
}

export const TOOL_CATALOGUE: ToolDef[] = [
  // Design
  { id: "figma", label: "Figma", group: "Design" },
  { id: "sketch", label: "Sketch", group: "Design" },
  { id: "framer", label: "Framer", group: "Design" },
  { id: "adobephotoshop", label: "Photoshop", group: "Design" },
  { id: "adobeillustrator", label: "Illustrator", group: "Design" },
  { id: "adobeaftereffects", label: "After Effects", group: "Design" },
  { id: "adobexd", label: "Adobe XD", group: "Design" },
  { id: "canva", label: "Canva", group: "Design" },
  { id: "blender", label: "Blender", group: "Design" },
  { id: "webflow", label: "Webflow", group: "Design" },
  // Productivity
  { id: "notion", label: "Notion", group: "Productivity" },
  { id: "slack", label: "Slack", group: "Productivity" },
  { id: "trello", label: "Trello", group: "Productivity" },
  { id: "linear", label: "Linear", group: "Productivity" },
  { id: "miro", label: "Miro", group: "Productivity" },
  { id: "airtable", label: "Airtable", group: "Productivity" },
  // Development
  { id: "visualstudiocode", label: "VS Code", group: "Development" },
  { id: "github", label: "GitHub", group: "Development" },
  { id: "gitlab", label: "GitLab", group: "Development" },
  { id: "react", label: "React", group: "Development" },
  { id: "nextdotjs", label: "Next.js", group: "Development" },
  { id: "nodedotjs", label: "Node.js", group: "Development" },
  { id: "typescript", label: "TypeScript", group: "Development" },
  { id: "python", label: "Python", group: "Development" },
  { id: "tailwindcss", label: "Tailwind", group: "Development" },
  { id: "supabase", label: "Supabase", group: "Development" },
  { id: "postgresql", label: "Postgres", group: "Development" },
  { id: "docker", label: "Docker", group: "Development" },
  // Media & marketing
  { id: "davinciresolve", label: "DaVinci", group: "Media" },
  { id: "premierepro", label: "Premiere Pro", icon: "adobepremierepro", group: "Media" },
  { id: "capcut", label: "CapCut", group: "Media" },
  { id: "ableton", label: "Ableton", icon: "abletonlive", group: "Media" },
  { id: "mailchimp", label: "Mailchimp", group: "Media" },
  { id: "hubspot", label: "HubSpot", group: "Media" },
  { id: "googleanalytics", label: "Analytics", group: "Media" },
  { id: "shopify", label: "Shopify", group: "Media" },
  // AI
  { id: "openai", label: "OpenAI", group: "AI" },
  { id: "claude", label: "Claude", group: "AI" },
  { id: "midjourney", label: "Midjourney", group: "AI" },
  { id: "huggingface", label: "Hugging Face", group: "AI" },
];

const BY_ID = new Map(TOOL_CATALOGUE.map((t) => [t.id, t]));

export function getTool(id: string): ToolDef {
  return (
    BY_ID.get(id) ?? {
      id,
      label: id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      group: "Other",
    }
  );
}

/** Brand SVG for a tool slug (transparent background, official colour). */
export function toolIconUrl(id: string): string {
  const t = getTool(id);
  const slug = (t.icon ?? t.id).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://cdn.simpleicons.org/${slug}`;
}

export const TOOL_GROUPS = Array.from(new Set(TOOL_CATALOGUE.map((t) => t.group)));

export const MAX_TOOLS = 12;

/** Cleans an unknown value into a safe tool-slug list. */
export function normaliseTools(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const slug = v.trim().toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 40);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= MAX_TOOLS) break;
  }
  return out;
}

/** Cleans a skill -> proficiency map (0-100 integers). */
export function normaliseSkillLevels(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim().slice(0, 32);
    const num = Math.round(Number(v));
    if (!key || !Number.isFinite(num)) continue;
    out[key] = Math.max(0, Math.min(100, num));
    if (++n >= 20) break;
  }
  return out;
}
