import {
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

export const CATEGORY_ICONS: Array<[RegExp, React.ComponentType<{ className?: string }>, string]> = [
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

export function visualForCategory(slug: string, name: string) {
  const key = `${slug} ${name}`.toLowerCase();
  const hit = CATEGORY_ICONS.find(([re]) => re.test(key));
  return { Icon: hit?.[1] ?? Layers, hue: hit?.[2] ?? "from-[#3A3A44] to-[#55555F]" };
}
