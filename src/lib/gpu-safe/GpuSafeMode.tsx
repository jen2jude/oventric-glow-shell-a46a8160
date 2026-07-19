import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Mode = "auto" | "on" | "off";
const KEY = "oventric.gpu-safe-mode";

interface Ctx {
  mode: Mode;
  active: boolean;
  setMode: (m: Mode) => void;
  toggle: () => void;
}

const GpuSafeCtx = createContext<Ctx>({
  mode: "auto",
  active: false,
  setMode: () => {},
  toggle: () => {},
});

/** Heuristic: treat low-memory / low-core Android as needing safe mode. */
function detectLowEnd(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (isAndroid && ((mem !== undefined && mem <= 4) || cores <= 4)) return true;
  return false;
}

function apply(active: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("gpu-safe", active);
}

export function GpuSafeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("auto");
  const [active, setActive] = useState(false);

  useEffect(() => {
    let m: Mode = "auto";
    try {
      const raw = window.localStorage.getItem(KEY) as Mode | null;
      if (raw === "on" || raw === "off" || raw === "auto") m = raw;
    } catch { /* ignore */ }
    setModeState(m);
    const a = m === "on" ? true : m === "off" ? false : detectLowEnd();
    setActive(a);
    apply(a);
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    try { window.localStorage.setItem(KEY, m); } catch { /* ignore */ }
    const a = m === "on" ? true : m === "off" ? false : detectLowEnd();
    setActive(a);
    apply(a);
  };

  const toggle = () => setMode(active ? "off" : "on");

  return (
    <GpuSafeCtx.Provider value={{ mode, active, setMode, toggle }}>
      {children}
    </GpuSafeCtx.Provider>
  );
}

export function useGpuSafeMode() {
  return useContext(GpuSafeCtx);
}
