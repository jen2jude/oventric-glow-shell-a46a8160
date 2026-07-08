import { Search, Bell, MessageCircle, Menu } from "lucide-react";
import { IncomingCircleInbox } from "@/components/oventric/IncomingCircleInbox";

export function Header({ onMenuClick, onOpenMessages }: { onMenuClick?: () => void; onOpenMessages?: () => void }) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-[#121214]/90 backdrop-blur-md border-b border-white/10 flex items-center gap-3 px-4 md:px-6">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="hidden md:flex p-2 rounded-lg hover:bg-white/5 text-slate-300 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xl font-black tracking-tight text-white">
          OVEN<span className="text-emerald-400">TRIC</span>
        </span>
      </div>

      <div className="flex-1 max-w-xl mx-auto min-w-0 hidden sm:block">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
          <input
            type="text"
            placeholder="Search creators, bounties, assets…"
            className="w-full h-10 pl-10 pr-4 bg-[#1E1E24] border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <button className="sm:hidden p-2 rounded-lg hover:bg-white/5 text-slate-300">
          <Search className="w-5 h-5" />
        </button>
        <button className="rgb-pulse-glow relative p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400" />
        </button>
        <button
          onClick={onOpenMessages}
          aria-label="Open messages"
          className="relative p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
        </button>
        <button className="rgb-pulse-glow w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-bold text-sm">
          OV
        </button>
      </div>
    </header>
  );
}
