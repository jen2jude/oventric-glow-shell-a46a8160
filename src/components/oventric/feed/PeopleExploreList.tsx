import { useState } from "react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface PeopleExploreItemProps {
  userId: string;
  name: string;
  username: string;
  description?: string;
  avatarUrl: string | null;
  slug: string;
  isVerified?: boolean;
}

export function PeopleExploreItem({
  name,
  username,
  description,
  avatarUrl,
  slug,
  isVerified = false,
}: PeopleExploreItemProps) {
  const [following, setFollowing] = useState(false);

  // Fallback description for demo if missing
  const displayDescription = description || "Digital Creator • Oventric Hub";

  return (
    <div className="flex items-start gap-3 py-4 border-b border-white/[0.06] last:border-0 px-4 active:bg-white/[0.02] transition-colors">
      <Link
        to="/profile/$id"
        params={{ id: slug }}
        className="relative shrink-0"
      >
        <div className="h-12 w-12 rounded-full overflow-hidden bg-[#1A1A1F] ring-1 ring-white/10">
          <AvatarImage src={avatarUrl} alt={name} />
        </div>
      </Link>

      <div className="flex-1 min-w-0 py-0.5">
        <Link
          to="/profile/$id"
          params={{ id: slug }}
          className="flex items-center gap-1 group"
        >
          <span className="text-[15px] font-bold text-white truncate group-active:text-[#E5484D] transition-colors leading-tight">
            {name}
          </span>
          {isVerified && (
            <CheckCircle2 className="h-3.5 w-3.5 fill-[#3897F0] text-[#0A0A0B]" />
          )}
        </Link>
        <p className="text-[12px] text-white/40 leading-none">@{username || slug}</p>
        
        <p className="mt-1.5 text-[13px] text-white/70 line-clamp-2 leading-relaxed">
          {displayDescription}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setFollowing(!following);
        }}
        className={`shrink-0 h-8 px-5 rounded-full text-[13px] font-bold transition-all active:scale-95 ${
          following
            ? "bg-white/10 text-white border border-white/10"
            : "bg-[#E5484D] text-white"
        }`}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}

export function PeopleExploreList({ users }: { users: any[] }) {
  return (
    <div className="flex flex-col bg-[#0A0A0B]">
      {users.map((user) => (
        <PeopleExploreItem
          key={user.id || user.user_id || user.userId}
          userId={user.user_id || user.userId || user.id}
          name={user.name || user.display_name}
          username={user.username || user.slug}
          description={user.description || user.bio}
          avatarUrl={user.avatarUrl || user.avatar_path}
          slug={user.slug}
          isVerified={user.is_verified || user.stars > 4.5}
        />
      ))}
    </div>
  );
}

