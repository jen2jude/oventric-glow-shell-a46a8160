import { useEffect, useState } from "react";

const DESKTOP_BREAKPOINT = 1024;

/**
 * True only after hydration on viewports >= 1024px.
 * SSR renders the mobile/app markup, so the server HTML stays stable.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
