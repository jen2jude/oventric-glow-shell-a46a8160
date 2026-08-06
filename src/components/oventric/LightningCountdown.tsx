import { useEffect, useState } from "react";

const FIVE_HOURS_MS = 5 * 3600 * 1000;

export function LightningCountdown() {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const timePassedInCycle = now % FIVE_HOURS_MS;
      setTimeLeft(FIVE_HOURS_MS - timePassedInCycle);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = Math.floor(timeLeft / (3600 * 1000));
  const minutes = Math.floor((timeLeft % (3600 * 1000)) / (60 * 1000));
  const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] sm:text-xs font-bold text-slate-500 whitespace-nowrap">Ends in:</span>
      <div className="flex gap-1 items-center">
        <span className="bg-slate-900 text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-sm min-w-[24px] text-center">
          {pad(hours)}
        </span>
        <span className="text-slate-900 font-black text-xs">:</span>
        <span className="bg-slate-900 text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-sm min-w-[24px] text-center">
          {pad(minutes)}
        </span>
        <span className="text-slate-900 font-black text-xs">:</span>
        <span className="bg-slate-900 text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-sm min-w-[24px] text-center">
          {pad(seconds)}
        </span>
      </div>
    </div>
  );
}
