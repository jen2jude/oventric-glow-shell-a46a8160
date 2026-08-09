import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProfileEcosystem, type ProfileEcosystem } from "@/lib/ecosystem.functions";
import { buildProfileSections, type VisibleSection } from "./sections";

/**
 * Loads a person's ecosystem summary and derives the adaptive section list.
 * Shared by the profile hub, seller shop panels and cross-entity link rows.
 */
export function useProfileEcosystem(idOrSlug: string | null | undefined, isOwner = false) {
  const load = useServerFn(getProfileEcosystem);
  const [data, setData] = useState<ProfileEcosystem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!idOrSlug) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    load({ data: { idOrSlug } })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idOrSlug, load]);

  const sections: VisibleSection[] = buildProfileSections(data?.counts ?? {}, { isOwner });

  return { ecosystem: data, sections, loading };
}
