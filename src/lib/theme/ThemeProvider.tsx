import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";
const KEY = "oventric.theme";

interface Ctx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<Ctx>({ theme: "dark", toggle: () => {}, setTheme: () => {} });

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("light", t === "light");
  el.classList.toggle("dark", t === "dark");
  el.dataset.theme = t;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY) as Theme | null;
      const initial: Theme = raw === "light" ? "light" : "dark";
      setThemeState(initial);
      applyTheme(initial);
    } catch {
      applyTheme("dark");
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try { window.localStorage.setItem(KEY, t); } catch { /* ignore */ }
  };
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
