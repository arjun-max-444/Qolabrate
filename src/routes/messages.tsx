import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { conversations, MESSAGE_LIMIT, messageError, timeAgo, type DirectMessage } from "@/lib/feed";

export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>): { to?: string } => (typeof s["to"] === "string" ? { to: s["to"] } : {}),
  head: () => pageHead("Messages", "Private direct messages between Qolabrate creators and brands."),
  component: Messages,
});

type Person = { id: string; handle: string; display_name: string; kind: string; is_demo: boolean };

function Messages() {
  const { user, role } = useAccount();
  const { to } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const signedIn = !!user && !!role;

  const me = useQuery({
    queryKey: ["feed", "me", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ensure_feed_profile");
      if (error) throw error;
      return data as string;
    },
  });
  const myId = me.data;

  const msgs = useQuery({
    queryKey: ["dm", myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_messages")
        .select("id, sender_id, recipient_id, body, created_at")
        .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as DirectMessage[];
    },
  });

  useEffect(() => {
    if (!myId) return;
    const ch = supabase
      .channel(`dm-${myId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_messages", filter: `recipient_id=eq.${myId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["dm", myId] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [myId, qc]);

  const convos = myId ? conversations(msgs.data ?? [], myId) : [];
  const ids = [...new Set([...convos.map((c) => c.other), ...(to ? [to] : [])])];

  const people = useQuery({
    queryKey: ["dm", "people", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_profiles").select("id, handle, display_name, kind, is_demo").in("id", ids);
      if (error) throw error;
      return new Map((data as Person[]).map((p) => [p.id, p]));
    },
  });
  const who = (id: string) => people.data?.get(id);

  const thread = (msgs.data ?? []).filter((m) => to && (m.sender_id === to || m.recipient_id === to));
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [thread.length, to]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("feed_messages").insert({ sender_id: myId!, recipient_id: to!, body });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); void qc.invalidateQueries({ queryKey: ["dm", myId] }); },
    onError: () => toast.error("Could not send your message"),
  });

  if (!signedIn) {
    return (
      <div style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Messages</h1>
        <p style={{ color: "var(--muted-foreground)", margin: ".6rem 0 1.2rem" }}>Sign in to send private messages to creators and brands.</p>
        <Link to="/auth" search={{ mode: "signin" }} className="q-pill q-pill-dark">Sign in</Link>
      </div>
    );
  }

  const other = to ? who(to) : undefined;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 320px) minmax(0, 1fr)", minHeight: "80vh", borderInline: "1px solid var(--border)" }} className="q-dm">
      <aside style={{ borderRight: "1px solid var(--border)" }} className={to ? "q-dm-list q-dm-hide-sm" : "q-dm-list"}>
        <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: ".6rem" }}>
          <Link to="/home" aria-label="Back to feed"><ArrowLeft size={18} /></Link>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Messages</h1>
        </div>
        {msgs.isLoading && <p style={{ padding: "1.2rem", color: "var(--muted-foreground)" }}>Loading…</p>}
        {msgs.isSuccess && convos.length === 0 && (
          <p style={{ padding: "1.2rem", color: "var(--muted-foreground)", fontSize: 14 }}>No conversations yet. Tap the envelope on any post in the feed to message someone.</p>
        )}
        {convos.map((c) => {
          const p = who(c.other);
          return (
            <button key={c.other} onClick={() => navigate({ to: "/messages", search: { to: c.other } })}
              style={{ display: "flex", gap: ".7rem", width: "100%", textAlign: "left", padding: ".9rem 1.2rem", borderBottom: "1px solid var(--border)", background: to === c.other ? "var(--muted)" : "transparent" }}>
              <div className="q-av">{(p?.display_name ?? "?").slice(0, 1)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 14 }}>{p?.display_name ?? "…"}</b> <small style={{ color: "var(--muted-foreground)" }}>· {timeAgo(c.last.created_at)}</small>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.last.sender_id === myId ? "You: " : ""}{c.last.body}
                </p>
              </div>
            </button>
          );
        })}
      </aside>

      <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }} className={to ? "" : "q-dm-hide-sm"}>
        {!to ? (
          <p style={{ margin: "auto", color: "var(--muted-foreground)" }}>Select a conversation</p>
        ) : (
          <>
            <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: ".6rem" }}>
              <button className="q-dm-back" aria-label="Back to conversations" onClick={() => navigate({ to: "/messages", search: {} })}><ArrowLeft size={18} /></button>
              <div className="q-av">{(other?.display_name ?? "?").slice(0, 1)}</div>
              <div>
                <b>{other?.display_name ?? "…"}</b><br />
                <small style={{ color: "var(--muted-foreground)" }}>@{other?.handle}{other?.kind === "brand" ? " · Brand" : ""}{other?.is_demo ? " · Demo" : ""}</small>
              </div>
            </div>
            {other?.is_demo && (
              <p style={{ padding: ".6rem 1.2rem", fontSize: 13, background: "var(--muted)", color: "var(--muted-foreground)" }}>
                This is a demo account. Your message is saved, but nobody will reply.
              </p>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.2rem", display: "flex", flexDirection: "column", gap: ".5rem", maxHeight: "60vh" }}>
              {thread.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: 14, margin: "auto" }}>Say hello 👋</p>}
              {thread.map((m) => {
                const mine = m.sender_id === myId;
                return (
                  <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                    <div style={{ padding: ".55rem .9rem", borderRadius: 18, fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      background: mine ? "var(--primary)" : "var(--muted)", color: mine ? "var(--primary-foreground)" : "var(--foreground)" }}>{m.body}</div>
                    <small style={{ color: "var(--muted-foreground)", fontSize: 11, display: "block", textAlign: mine ? "right" : "left" }}>{timeAgo(m.created_at)}</small>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form style={{ display: "flex", gap: ".5rem", padding: ".8rem 1.2rem", borderTop: "1px solid var(--border)" }}
              onSubmit={(e) => { e.preventDefault(); const err = messageError(text); if (err) { toast.error(err); return; } send.mutate(text.trim()); }}>
              <input aria-label="Write a message" placeholder="Write a message…" maxLength={MESSAGE_LIMIT} value={text} onChange={(e) => setText(e.target.value)}
                style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 999, padding: ".55rem 1rem", fontSize: 14, background: "var(--background)" }} />
              <button type="submit" disabled={!myId || send.isPending || to === myId} className="q-pill q-pill-dark" style={{ height: 38 }}>Send</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
