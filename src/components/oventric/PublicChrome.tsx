import { type ReactNode, useState } from "react";
import { Header } from "@/components/oventric/Header";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";

/**
 * Shared site chrome for standalone routes (blog, profile, etc.).
 * The mobile footer nav is rendered globally in __root.tsx, so this
 * wrapper only provides the header and messages drawer.
 */
export function PublicChrome({ children, active: _active = "" }: { children: ReactNode; active?: string }) {
  const [messagesOpen, setMessagesOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-[#121214] text-slate-200 flex flex-col">
      <Header onOpenMessages={() => setMessagesOpen(true)} />
      <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden pb-20 md:pb-0">{children}</main>
      <MessagesDrawer open={messagesOpen} onClose={() => setMessagesOpen(false)} />
    </div>
  );
}
