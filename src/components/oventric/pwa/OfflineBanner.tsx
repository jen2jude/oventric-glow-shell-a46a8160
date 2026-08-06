import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Slim banner shown whenever the device loses connectivity. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-amber-500 py-1.5 text-[11px] font-bold text-[#1a1200]"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.375rem)" }}
    >
      <WifiOff className="h-3.5 w-3.5" />
      You're offline — showing saved content
    </div>
  );
}
