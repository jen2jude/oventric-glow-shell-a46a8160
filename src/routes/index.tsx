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
import { CreatePanel, type ChoiceKey } from "@/components/oventric/CreatePanel";

import { Messages } from "@/components/oventric/Messages";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { CirclesHub } from "@/components/oventric/CirclesHub";
import { HomeHub } from "@/components/oventric/HomeHub";
import { DesktopHome } from "@/components/oventric/desktop/DesktopHome";
import { DesktopAppSidebar } from "@/components/oventric/desktop/DesktopAppSidebar";

import { useIsDesktop } from "@/hooks/use-desktop";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useSectionLiveCounter } from "@/lib/useSectionLiveCounter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oventric — Sell, learn and get paid across Africa" },
      {
        name: "description",
        content:
          "Marketplace, academy, bounties and a multi-currency wallet in one platform. Escrow-protected payments in your own currency.",
      },
      { property: "og:title", content: "Oventric — Sell, learn and get paid across Africa" },
      {
        property: "og:description",
        content:
          "Marketplace, academy, bounties and a multi-currency wallet in one platform. Escrow-protected payments in your own currency.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/" }],
  }),
  component: Index,
});

function Index() {
  const [createOpen, setCreateOpen] = useState(false);
  const [createChoice, setCreateChoice] = useState<ChoiceKey | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [messagesPeer, setMessagesPeer] = useState<string | undefined>(undefined);
  const [active, setActive] = useState("Home");

  const { require } = useOnboarding();

  // Create flow: auth-gate for anonymous visitors, then open the create panel.
  const handleCreate = (choice?: ChoiceKey) =>
    require(
      1,
      () => {
        setCreateChoice(choice ?? null);
        setCreateOpen(true);
      },
      "seller",
    );

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
    const onOpenDM = (e: Event) => {
      const detail = (e as CustomEvent<{ peerId?: string }>).detail;
      if (detail?.peerId) {
        setMessagesPeer(detail.peerId);
        setMessagesOpen(true);
      }
    };
    window.addEventListener("oventric:navigate", onNav);
    window.addEventListener("oventric:open-dm", onOpenDM);
    return () => {
      window.removeEventListener("oventric:navigate", onNav);
      window.removeEventListener("oventric:open-dm", onOpenDM);
    };
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

  // Deep link ?section=<name>&bounty=<id>&dm=<peerId> (used by notification links).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    const bountyId = params.get("bounty");
    const dmPeer = params.get("dm");
    const allowed = [
      "Home",
      "Feed",
      "Marketplace",
      "Academy",
      "Bounties",
      "Wallet",
      "Circles",
      "Messages",
    ];
    if (section && allowed.includes(section)) setActive(section);
    if (bountyId) {
      setActive("Bounties");
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("oventric:bounty:open-detail", { detail: { id: bountyId } }),
        );
      }, 160);
    }
    if (dmPeer) {
      setMessagesPeer(dmPeer);
      setMessagesOpen(true);
    }
    if (!section && !bountyId && !dmPeer) return;
    params.delete("section");
    params.delete("bounty");
    params.delete("dm");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, []);

  const isDesktop = useIsDesktop();
  const desktopLanding = isDesktop && active === "Home";

  const view =
    active === "Home" ? (
      desktopLanding ? (
        <DesktopHome onSelect={setActive} onCreate={handleCreate} />
      ) : (
        <HomeHub
          onSelect={setActive}
          onCreate={handleCreate}
          onOpenMessages={() => setMessagesOpen(true)}
          counts={{
            Feed: feedCount.count,
            Market: marketCount.count,
            Academy: academyCount.count,
            Bounties: bountiesCount.count,
            Wallet: walletCount.count,
          }}
        />
      )
    ) : active === "Wallet" ? (
      <Wallet />
    ) : active === "Marketplace" ? (
      <Marketplace />
    ) : active === "Academy" ? (
      <Academy />
    ) : active === "Bounties" ? (
      <Bounties />
    ) : active === "Messages" ? (
      <Messages variant="page" />
    ) : active === "Circles" ? (
      <CirclesHub />
    ) : (
      <Feed />
    );

  const isMessages = active === "Messages";

  return (
    <div className="relative h-screen overflow-hidden bg-[#121214] text-slate-200">
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50  hidden md:block" />

      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50  hidden md:block" />

      <div className="flex h-full flex-col">
        {!desktopLanding && (
          <Header
            onOpenMessages={() => setMessagesOpen(true)}
            showMobileTopRow
            hubMode={(active === "Home" || active === "Marketplace") && !isDesktop}
            desktopNav={
              isDesktop &&
              ["Marketplace", "Academy", "Bounties", "Circles", "Feed"].includes(active)
            }
            light={isDesktop}
          />
        )}

        <div
          className={`flex flex-1 min-h-0 ${(active === "Home" || active === "Marketplace") && !isDesktop ? "pt-12 md:pt-[4.5rem]" : ""}`}
        >
          {!isDesktop && <Sidebar onCreate={handleCreate} active={active} onSelect={setActive} />}
          {isDesktop && !desktopLanding && <DesktopAppSidebar onSelect={setActive} />}

          <main
            id={desktopLanding ? "desktop-home-scroll" : undefined}
            className={`flex-1 min-w-0 min-h-0 ${isMessages ? "overflow-hidden" : "overflow-y-auto"} ${desktopLanding ? "" : "pb-20 md:pb-0"} ${isDesktop && (active === "Academy" || active === "Bounties" || active === "Circles" || active === "Feed" || active === "Messages") ? "bg-white" : ""}`}
          >
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

      <CreatePanel
        open={createOpen}
        initialChoice={createChoice}
        onClose={() => {
          setCreateOpen(false);
          setCreateChoice(null);
        }}
      />
      <MessagesDrawer
        open={messagesOpen}
        onClose={() => {
          setMessagesOpen(false);
          setMessagesPeer(undefined);
        }}
        initialThreadId={messagesPeer}
      />
    </div>
  );
}
