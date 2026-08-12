import { useState } from "react";
import { ArrowLeft } from "lucide-react";

export type ExploreTab = "All" | "People" | "Products" | "Shops" | "Services" | "Posts" | "Courses" | "Jobs";

const TABS: ExploreTab[] = ["All", "People", "Products", "Shops", "Services", "Posts", "Courses", "Jobs"];

export function ExploreHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: ExploreTab;
  onTabChange: (tab: ExploreTab) => void;
}) {
  return (
    <div className="bg-[#0A0A0B] pt-3">
      <div className="px-4 mb-3 flex items-center gap-4">
        <button 
          onClick={() => onTabChange("Discovery" as any)}
          className="p-1 -ml-1 text-white active:text-[#E5484D] transition-colors"
        >
          <ArrowLeft className="w-6 h-6" strokeWidth={3} />
        </button>
        <h1 className="text-[22px] font-black text-white tracking-tight">Explore</h1>
      </div>
      
      <div className="flex border-b border-white/[0.06]">
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className="relative flex-1 py-3 text-[14px] font-bold transition-colors"
            >
              <span className={active ? "text-white" : "text-white/40"}>
                {tab}
              </span>
              {active && (
                <div className="absolute bottom-0 left-0 w-full h-[3.5px] bg-[#E5484D] rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>

  );
}
