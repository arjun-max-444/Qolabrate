import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/messages/")({
  component: () => (
    <div className="grid flex-1 place-items-center px-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface"><MessageCircle className="h-7 w-7" /></div>
        <h2 className="mt-4 text-xl font-bold">Select a conversation</h2>
        <p className="mt-1 max-w-[320px] text-sm text-muted-foreground">Choose a chat on the left, or start a new one with creators and brands you work with.</p>
      </div>
    </div>
  ),
});
