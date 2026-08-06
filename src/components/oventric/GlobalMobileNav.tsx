import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { MobileNav } from "@/components/oventric/MobileNav";
import { CreatePanel } from "@/components/oventric/CreatePanel";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useLaunchContext } from "@/hooks/use-launch-context";

/**
 * App-wide mobile footer nav. Rendered once at the root so every route
 * shows the same bottom bar (matches the user-profile page behavior).
 * Selecting a section navigates to "/" and dispatches `oventric:navigate`
 * so the index route swaps to the requested section.
 */
export function GlobalMobileNav() {
  const navigate = useNavigate();
  const { require } = useOnboarding();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [createOpen, setCreateOpen] = useState(false);

  const launchCtx = useLaunchContext();
  const isAppShell = launchCtx === "native" || launchCtx === "standalone";

  // Hide on admin routes, on "/" (index renders its own nav), and on product pages for browser users.
  if (pathname.startsWith("/admin") || pathname === "/") return null;
  if (pathname.startsWith("/product/") && !isAppShell) return null;

  const goSection = (label: string) => {
    const section = label === "Market" ? "Marketplace" : label;
    if (pathname !== "/") {
      navigate({ to: "/" });
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } }));
      }, 30);
    } else {
      window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } }));
    }
  };

  const handleCreate = () => require(1, () => setCreateOpen(true), "seller");

  return (
    <>
      <MobileNav onCreate={handleCreate} active="" onSelect={goSection} />
      <CreatePanel open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
