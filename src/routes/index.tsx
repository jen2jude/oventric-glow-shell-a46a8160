import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/oventric/Header";
import { Sidebar } from "@/components/oventric/Sidebar";
import { MobileNav } from "@/components/oventric/MobileNav";
import { Feed } from "@/components/oventric/Feed";
import { Wallet } from "@/components/oventric/Wallet";
import { Marketplace } from "@/components/oventric/Marketplace";
import { Academy } from "@/components/oventric/Academy";
import { Bounties } from "@/components/oventric/Bounties";
import { CreatePanel } from "@/components/oventric/CreatePanel";

import { Messages } from "@/components/oventric/Messages";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { CirclesHub } from "@/components/oventric/CirclesHub";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useSectionLiveCounter } from "@/lib/useSectionLiveCounter";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oventric — The multi-vendor tech platform" },
      { name: "description", content: "Feed, marketplace, academy, bounties, and wallet — one platform for builders." },
      { property: "og:title", content: "Oventric — The multi-vendor tech platform" },
      { property: "og:description", content: "Feed, marketplace, academy, bounties, and wallet — one platform for builders." },
    ],
  }),
  component: Index,
});

function Index() {
  const [createOpen, setCreateOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [active, setActive] = useState("Feed");
  const { require } = useOnboarding();

  // Create flow: auth-gate for anonymous visitors, then open the create panel.
  const handleCreate = () => require(1, () => setCreateOpen(true), "seller");

  // Live counters for each mobile-footer section. Each increments as new rows
  // are inserted on the corresponding table and clears when that section is
  // active.
  const feedCount = useSectionLiveCounter({
    section: "feed",
    table: "posts",
    active: active === "Feed",
    excludeSelf: true,
  });
  const marketCount = useSectionLiveCounter({
    section: "market",
    table: "products",
    active: active === "Marketplace",
    excludeSelf: true,
  });
  const academyCount = useSectionLiveCounter({
    section: "academy",
    table: "courses",
    active: active === "Academy",
    excludeSelf: true,
  });
  const bountiesCount = useSectionLiveCounter({
    section: "bounties",
    table: "bounties",
    active: active === "Bounties",
    excludeSelf: true,
  });
  const walletCount = useSectionLiveCounter({
    section: "wallet",
    table: "wallet_transactions",
    active: active === "Wallet",
    requireAuth: true,
  });


  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<{ section?: string }>).detail;
      if (detail?.section) setActive(detail.section);
    };
    window.addEventListener("oventric:navigate", onNav);
    return () => window.removeEventListener("oventric:navigate", onNav);
  }, []);

  // Resume the bounty publish flow after a successful wallet top-up.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "bounty") return;
    setActive("Bounties");
    // Give Bounties a tick to mount its listener before opening the editor.
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("oventric:bounty:open"));
    }, 120);
    // Clean the URL so refreshes don't re-trigger the flow.
    params.delete("resume");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
    return () => clearTimeout(t);
  }, []);

  const view =
    active === "Wallet" ? <Wallet />
    : active === "Marketplace" ? <Marketplace />
    : active === "Academy" ? <Academy />
    : active === "Bounties" ? <Bounties />
    : active === "Messages" ? <Messages variant="page" />
    : active === "Circles" ? <CirclesHub />
    : <Feed />;

  const isMessages = active === "Messages";

  return (
    <div className="relative h-screen overflow-hidden bg-[#121214] text-slate-200">
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50 rgb-neon-bg hidden md:block" />

      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />

      <div className="flex h-full flex-col">
        <Header onOpenMessages={() => setMessagesOpen(true)} showMobileTopRow />
        <div className="flex flex-1 min-h-0">
          <Sidebar onCreate={handleCreate} active={active} onSelect={setActive} />
          <main className={`flex-1 min-w-0 min-h-0 ${isMessages ? "overflow-hidden" : "overflow-y-auto"} pb-20 md:pb-0`}>
            {view}
          </main>
        </div>
        <MobileNav
          onCreate={handleCreate}
          active={active === "Wallet" ? "Wallet" : active === "Marketplace" ? "Market" : active}
          onSelect={(l) => setActive(l === "Market" ? "Marketplace" : l)}
          counts={{
            Feed: feedCount.count,
            Market: marketCount.count,
            Academy: academyCount.count,
            Bounties: bountiesCount.count,
            Wallet: walletCount.count,
          }}
        />

      </div>

      <CreatePanel open={createOpen} onClose={() => setCreateOpen(false)} />
      <MessagesDrawer open={messagesOpen} onClose={() => setMessagesOpen(false)} />
    </div>
  );
}
