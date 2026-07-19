import { type ReactNode, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/oventric/Header";
import { MobileNav } from "@/components/oventric/MobileNav";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { CreatePanel } from "@/components/oventric/CreatePanel";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

/**
 * Shared site chrome for standalone routes (blog, profile, etc.) so users
 * always have a way back to the main sections. Mobile nav selections
 * navigate home and dispatch `oventric:navigate` so the index route can
 * swap to the requested section.
 */
export function PublicChrome({ children, active = "" }: { children: ReactNode; active?: string }) {
  const navigate = useNavigate();
  const { require } = useOnboarding();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const goSection = (label: string) => {
    const section = label === "Market" ? "Marketplace" : label;
    navigate({ to: "/" });
    // Defer so the index route mounts its listener before we dispatch.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } }));
    }, 30);
  };

  const handleCreate = () => require(1, () => setCreateOpen(true), "seller");

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-[#121214] text-slate-200 flex flex-col">
      <Header onOpenMessages={() => setMessagesOpen(true)} />
      <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden pb-20 md:pb-0">{children}</main>
      <MobileNav onCreate={handleCreate} active={active} onSelect={goSection} />
      <MessagesDrawer open={messagesOpen} onClose={() => setMessagesOpen(false)} />
      <CreatePanel open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
