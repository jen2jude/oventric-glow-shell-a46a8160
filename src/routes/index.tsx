import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/oventric/Header";
import { Sidebar } from "@/components/oventric/Sidebar";
import { MobileNav } from "@/components/oventric/MobileNav";
import { Feed } from "@/components/oventric/Feed";
import { Wallet } from "@/components/oventric/Wallet";
import { Marketplace } from "@/components/oventric/Marketplace";
import { Academy } from "@/components/oventric/Academy";
import { Bounties } from "@/components/oventric/Bounties";
import { CreatePanel } from "@/components/oventric/CreatePanel";
import { OnboardingProvider, useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { StageModals } from "@/components/oventric/onboarding/StageModals";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oventric — The multi-vendor tech platform" },
      { name: "description", content: "Feed, marketplace, academy, bounties, and wallet — one platform for builders." },
      { property: "og:title", content: "Oventric" },
      { property: "og:description", content: "The multi-vendor tech platform for builders." },
    ],
  }),
  component: Index,
});

function IndexInner() {
  const [createOpen, setCreateOpen] = useState(false);
  const [active, setActive] = useState("Feed");
  const { require } = useOnboarding();

  const handleCreate = () => require(1, () => setCreateOpen(true));

  const view =
    active === "Wallet" ? <Wallet /> : active === "Marketplace" ? <Marketplace /> : active === "Academy" ? <Academy /> : <Feed />;

  return (
    <div className="relative h-screen overflow-hidden bg-[#121214] text-slate-200">
      {/* Animated neon frame */}
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50 rgb-neon-bg" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50 rgb-neon-bg" />
      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />

      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar onCreate={handleCreate} active={active} onSelect={setActive} />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{view}</main>
        </div>
        <MobileNav onCreate={handleCreate} active={active === "Wallet" ? "Wallet" : active === "Marketplace" ? "Market" : active} onSelect={(l) => setActive(l === "Market" ? "Marketplace" : l)} />
      </div>

      <CreatePanel open={createOpen} onClose={() => setCreateOpen(false)} />
      <StageModals />
    </div>
  );
}

function Index() {
  return (
    <OnboardingProvider>
      <IndexInner />
    </OnboardingProvider>
  );
}
