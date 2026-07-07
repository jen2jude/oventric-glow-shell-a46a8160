import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/oventric/Header";
import { Sidebar } from "@/components/oventric/Sidebar";
import { MobileNav } from "@/components/oventric/MobileNav";
import { Feed } from "@/components/oventric/Feed";
import { CreatePanel } from "@/components/oventric/CreatePanel";

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

function Index() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="relative h-screen overflow-hidden bg-[#121214] text-slate-200">
      {/* Animated neon frame - top & bottom bars */}
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50 rgb-neon-bg" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50 rgb-neon-bg" />
      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />

      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar onCreate={() => setCreateOpen(true)} />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            <Feed />
          </main>
        </div>
        <MobileNav onCreate={() => setCreateOpen(true)} />
      </div>

      <CreatePanel open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
