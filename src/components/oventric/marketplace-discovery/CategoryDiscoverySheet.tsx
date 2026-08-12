import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Palette,
  LayoutTemplate,
  Box,
  Music,
  Code2,
  Camera,
  Briefcase,
  GraduationCap,
  Sparkles,
  ShoppingBag,
  Smartphone,
  Shirt,
  Sofa,
  Dumbbell,
  Gamepad2,
  Car,
  PawPrint,
  Heart,
  Video,
  Puzzle,
  FileCode2,
  Newspaper,
  Layers,
} from "lucide-react";
import type { CategoryNode } from "@/lib/marketplace.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: CategoryNode[];
  counts: Record<string, number>;
  onSelectCategory: (cat: CategoryNode) => void;
}

const ICONS: Array<[RegExp, React.ComponentType<{ className?: string }>, string]> = [
  [/design|creative|graphic/, Palette, "from-[#6C5CE7] to-[#8E7BFF]"],
  [/theme|template|page builder|elemetor|woocommerce|html/, LayoutTemplate, "from-[#B84D9B] to-[#E05FAE]"],
  [/3d|illustration|blocks/, Box, "from-[#E07A2F] to-[#F0A05A]"],
  [/music|audio/, Music, "from-[#4B5BD7] to-[#6E7BF0]"],
  [/script|code|plugin/, Code2, "from-[#2F7FE0] to-[#4FA3F5]"],
  [/photo/, Camera, "from-[#D7444C] to-[#F06A72]"],
  [/business|real estate|shopping/, Briefcase, "from-[#5A6B63] to-[#7C8F86]"],
  [/education|news|blog|magazine/, GraduationCap, "from-[#7A34D4] to-[#9B5CF0]"],
  [/lifestyle|social|personal/, Sparkles, "from-[#D63A3A] to-[#F0605F]"],
  [/accessor/, ShoppingBag, "from-[#7A6A55] to-[#9E8B70]"],
  [/electronic|phone|laptop|gadget/, Smartphone, "from-[#E0662F] to-[#F58C55]"],
  [/fashion|cloth|shoe|watch|men|women|kid/, Shirt, "from-[#C7407F] to-[#E9689F]"],
  [/home|living|furniture|kitchen|decor|appliance/, Sofa, "from-[#2FB09B] to-[#54D3BC]"],
  [/sport|fitness|outdoor|bike/, Dumbbell, "from-[#3D6FC4] to-[#5F92E8]"],
  [/toy|game/, Gamepad2, "from-[#E08A1F] to-[#F5AC49]"],
  [/vehicle|car|part|automotive/, Car, "from-[#D6423A] to-[#F26B62]"],
  [/pet|animal|dog|cat/, PawPrint, "from-[#B0592F] to-[#D57F52]"],
  [/beauty|health|skincare|makeup|wellness|fragrance/, Heart, "from-[#D63A6F] to-[#F26896]"],
  [/video|movie|entertainment|capcut/, Video, "from-[#6E3AD6] to-[#9464F2]"],
  [/ai|lovable/, Puzzle, "from-[#2F8FE0] to-[#57B2F5]"],
  [/buddypress|others/, FileCode2, "from-[#4A5568] to-[#6B7688]"],
  [/blogger/, Newspaper, "from-[#8A5A2F] to-[#B07E4F]"],
];

function visualFor(slug: string, name: string) {
  const key = `${slug} ${name}`.toLowerCase();
  const hit = ICONS.find(([re]) => re.test(key));
  return { Icon: hit?.[1] ?? Layers, hue: hit?.[2] ?? "from-[#3A3A44] to-[#55555F]" };
}

export function CategoryDiscoverySheet({ open, onClose, categories, counts, onSelectCategory }: Props) {
  const [kind, setKind] = useState<"physical" | "digital">("physical");
  const [parent, setParent] = useState<CategoryNode | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setParent(null);
      setQuery("");
      setSearching(false);
    }
  }, [open]);

  if (!open) return null;

  const countFor = (c: CategoryNode): number =>
    (counts[c.slug] ?? 0) + c.children.reduce((n, k) => n + (counts[k.slug] ?? 0), 0);

  const roots = categories.filter((c) => c.kind === kind);
  const level = parent ? parent.children : roots;
  const list = query.trim()
    ? level.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : level;

  const back = () => (parent ? setParent(null) : onClose());

  return (
    <div className="fixed inset-0 z-[120] bg-[#0A0A0B]">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div
          className="shrink-0 px-4 pb-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <button type="button" onClick={back} className="grid h-11 w-11 place-items-center rounded-full">
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <h2 className="truncate text-center text-[17px] font-bold text-white">
              {parent ? parent.name : "Categories"}
            </h2>
            <button
              type="button"
              onClick={() => setSearching((s) => !s)}
              className="grid h-11 w-11 place-items-center rounded-full"
            >
              {searching ? <X className="h-5 w-5 text-white" /> : <Search className="h-5 w-5 text-white" />}
            </button>
          </div>

          {searching && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              className="mt-3 w-full rounded-[10px] bg-[#141416] px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/35"
            />
          )}

          {!parent && (
            <div className="mt-3 flex gap-2 rounded-[10px] bg-[#141416] p-1.5">
              {(["physical", "digital"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-[10px] py-2.5 text-[13px] font-bold capitalize transition-colors ${
                    kind === k ? "bg-[#E5484D] text-white" : "text-white/50"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10">
          <div className="space-y-2.5">
            {list.map((cat) => {
              const { Icon, hue } = visualFor(cat.slug, cat.name);
              const n = countFor(cat);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => (cat.children.length > 0 ? setParent(cat) : (onSelectCategory(cat), onClose()))}
                  className="flex w-full items-center gap-3.5 rounded-[10px] bg-[#131316] p-3 text-left active:scale-[0.995]"
                >
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br ${hue}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-white">{cat.name}</span>
                    <span className="block text-[12px] text-white/40">
                      {n.toLocaleString()} {n === 1 ? "product" : "products"}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-white/30" />
                </button>
              );
            })}
            {list.length === 0 && (
              <p className="py-24 text-center text-[13px] text-white/40">No categories here yet.</p>
            )}
          </div>

          {parent && (
            <button
              type="button"
              onClick={() => {
                onSelectCategory(parent);
                onClose();
              }}
              className="mt-4 w-full rounded-[10px] bg-[#E5484D] py-3.5 text-[13.5px] font-bold text-white"
            >
              View all in {parent.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
