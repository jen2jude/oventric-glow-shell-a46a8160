import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLiveFxRates } from "@/lib/fx.functions";
import { setRuntimeFxRates } from "@/lib/fx-display";

const REFRESH_MS = 15 * 60 * 1000;

/**
 * Pulls current USD-base FX rates and publishes them to the display layer so
 * every price conversion across the app uses near-live rates. Returns a version
 * counter that changes whenever rates are refreshed, which re-renders the tree.
 */
export function useLiveFx(): number {
  const fetchRates = useServerFn(getLiveFxRates);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchRates()
        .then((r) => {
          if (cancelled || !r?.rates) return;
          setRuntimeFxRates(r.rates);
          setVersion((v) => v + 1);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchRates]);

  return version;
}
