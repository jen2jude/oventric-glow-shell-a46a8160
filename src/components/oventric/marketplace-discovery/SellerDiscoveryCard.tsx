import { Star, CheckCircle2, ShoppingBag, Users } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";

interface SellerDiscoveryCardProps {
  seller: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    verified?: boolean;
    rating: number;
    followersCount: number;
    productsCount: number;
    category?: string;
    coverUrl?: string | null;
  };
  onClick?: () => void;
}

export function SellerDiscoveryCard({
  seller,
  onClick,
}: SellerDiscoveryCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col bg-[#121214] border border-white/5 rounded-2xl overflow-hidden cursor-pointer hover:border-red-500/20 transition-all w-64 shrink-0"
    >
      <div className="h-20 bg-gradient-to-br from-red-600/20 to-black relative overflow-hidden">
        {seller.coverUrl && (
          <img src={seller.coverUrl} className="w-full h-full object-cover opacity-50 transition-transform group-hover:scale-110" alt="" />
        )}
        <div className="absolute inset-0 bg-black/40" />
      </div>
      
      <div className="px-4 pb-4 -mt-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl border-4 border-[#121214] overflow-hidden bg-slate-900 shadow-xl mb-3 relative z-10 group-hover:scale-105 transition-transform">
          <AvatarImage src={seller.avatarUrl} alt={seller.name} />
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1">
            <h3 className="text-sm font-black text-white truncate max-w-[140px]">
              {seller.name}
            </h3>
            {seller.verified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-red-500 fill-current bg-white rounded-full" />
            )}
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {seller.category || "General Vendor"}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 text-emerald-400 my-3">
          <Star className="w-3 h-3 fill-current" />
          <span className="text-xs font-black">{seller.rating.toFixed(1)}</span>
        </div>

        <div className="grid grid-cols-2 w-full gap-2 border-t border-white/5 pt-3">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-white">
              {seller.followersCount.toLocaleString()}
            </span>
            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-500 uppercase">
              <Users className="w-2 h-2" />
              Followers
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-white">
              {seller.productsCount}
            </span>
            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-500 uppercase">
              <ShoppingBag className="w-2 h-2" />
              Products
            </div>
          </div>
        </div>

        <button className="mt-4 w-full bg-white/5 hover:bg-red-600 hover:text-white text-slate-300 font-black py-2 rounded-lg text-[9px] uppercase tracking-widest transition-all">
          View Store
        </button>
      </div>
    </div>
  );
}
