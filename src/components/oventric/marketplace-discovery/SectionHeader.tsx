import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onViewAll?: () => void;
  viewAllText?: string;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  onViewAll,
  viewAllText = "View All",
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between mb-6 ${className}`}>
      <div className="space-y-1">
        <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            {subtitle}
          </p>
        )}
      </div>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs font-black text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest"
        >
          {viewAllText}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
