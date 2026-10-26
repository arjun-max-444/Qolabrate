import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, LogOut, MonitorSmartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { AUTHOR_SELECT, type Author } from "@/lib/posts";
import { deleteMyAccount } from "@/lib/account.functions";
import { VerificationSection } from "@/components/app/VerificationSection";
import { PageHeader, Tabs, useSignOut } from "@/components/app/AppShell";
import { ProfileForm } from "@/components/app/ProfileForm";
import { Avatar } from "@/components/app/Avatar";
import { btnOutline, btnSmOutline, btnSmPrimary, field } from "@/components/app/styles";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Section = "profile" | "account" | "privacy" | "notifications";
const SECTIONS: Section[] = ["profile", "account", "privacy", "notifications"];

export const Route = createFileRoute("/_authenticated/_shell/settings")({
  validateSearch: (s: Record<string, unknown>): { section?: Section } => (SECTIONS.includes(s["section"] as Section) ? { section: s["section"] as Section } : {}),
  head: () => ({ meta: [{ title: "Settings — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

const h2 = "text-lg font-bold";
const sectionCls = "border-b px-5 py-6";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span><span className="block text-[15px] font-medium">{label}</span>{hint && <span className="block text-sm text-muted-foreground">{hint}</span>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${checked ? "bg-foreground" : "bg-surface-strong"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </label>
  );
}

function AccountSection() {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteMyAccount);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const isEmailUser = user?.app_metadata?.["provider"] === "email";

  const changePassword = async () => {
    if (!user?.email) return;
    if (next.length < 8) { toast.error("Use at least 8 characters for your new password."); return; }
    setBusy(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (authErr) { setBusy(false); toast.error("Your current password is incorrect."); return; }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCurrent(""); setNext("");
    toast.success("Password updated");
  };
  const sendReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };
  const signOutOthers = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) { toast.error(error.message); return; }
    toast.success("Signed out of all other devices");
  };
  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteFn({ data: { confirm: typed } });
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete your account.");
    } finally { setBusy(false); }
  };

  return (
    <>
      <VerificationSection />
      <section className={sectionCls}>
        <h2 className={h2}>Account</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Email</dt><dd className="truncate font-medium">{user?.email}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Username</dt><dd className="font-medium">@{me?.username}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Account type</dt><dd className="font-medium capitalize">{me?.account_type} · locked</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Verified</dt><dd className="font-medium">{me?.verified ? "Yes" : "Not yet"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Change your name and username under Profile. Account types can't be switched; for a {me?.account_type === "brand" ? "creator" : "brand"} account, sign up with a different email.</p>
      </section>

      <section className={sectionCls}>
        <h2 className={h2}>Password</h2>
        {isEmailUser ? (
          <form className="mt-3 grid gap-3 sm:max-w-sm" onSubmit={(e) => { e.preventDefault(); changePassword(); }}>
            <input aria-label="Current password" type="password" autoComplete="current-password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" />
            <input aria-label="New password" type="password" autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (8+ characters)" />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy || !current || !next} className={btnSmPrimary}><KeyRound className="h-4 w-4" />Update password</button>
              <button type="button" disabled={sent} onClick={sendReset} className={btnSmOutline}>{sent ? "Reset link sent" : "Forgot it? Email me a link"}</button>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">You sign in with {String(user?.app_metadata?.["provider"] ?? "a connected account")}, so there's no Qolabrate password to change.</p>
        )}
      </section>

      <section className={sectionCls}>
        <h2 className={h2}>Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">Signed in on a shared or lost device? Sign out everywhere except here.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={signOutOthers} className={btnOutline}><MonitorSmartphone className="h-4 w-4" />Sign out other devices</button>
          <button type="button" onClick={signOut} className={btnOutline}><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </section>

      <section className="px-5 py-6">
        <h2 className={h2}>Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Permanently removes your profile, posts, messages you sent, campaigns and collaboration data. This can't be undone.</p>
        <button type="button" onClick={() => setConfirmDelete(true)} className={`${btnOutline} mt-4 border-destructive text-destructive`}><Trash2 className="h-4 w-4" />Delete my account</button>
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => { setConfirmDelete(o); if (!o) setTyped(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>Type your username <b>{me?.username}</b> to confirm. Everything will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <input aria-label="Type your username to confirm" className={field} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={me?.username ?? ""} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || typed.trim().toLowerCase() !== me?.username?.toLowerCase()} onClick={(e) => { e.preventDefault(); doDelete(); }} className="bg-destructive text-destructive-foreground">
              {busy ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PrivacySection() {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const [contact, setContact] = useState("");
  useEffect(() => { setContact(me?.contact_email ?? ""); }, [me?.contact_email]);

  const update = async (patch: { dm_permission?: string; collab_permission?: string; show_email?: boolean; contact_email?: string | null }) => {
    const { error } = await supabase.from("v2_profiles").update(patch).eq("id", user!.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Privacy updated");
  };
  const { data: blocked = [], refetch } = useQuery({
    queryKey: ["blocked", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("blocks").select(`created_at, blocked:v2_profiles!blocks_blocked_id_fkey(${AUTHOR_SELECT})`).eq("blocker_id", user!.id).order("created_at", { ascending: false });
      return (data ?? []).map((r) => r.blocked as unknown as Author).filter(Boolean);
    },
  });
  const unblock = async (id: string) => {
    await supabase.from("blocks").delete().eq("blocker_id", user!.id).eq("blocked_id", id);
    refetch();
    toast.success("Unblocked");
  };
  const select = "h-10 rounded-full border bg-background px-3 text-sm outline-none focus:border-foreground";

  if (!me) return null;
  return (
    <>
      <section className={sectionCls}>
        <h2 className={h2}>Privacy</h2>
        <div className="mt-3 divide-y">
          <label className="flex items-center justify-between gap-4 py-3">
            <span><span className="block text-[15px] font-medium">Who can message you</span><span className="block text-sm text-muted-foreground">Existing conversations stay open.</span></span>
            <select className={select} value={me.dm_permission} onChange={(e) => update({ dm_permission: e.target.value })}>
              <option value="everyone">Everyone</option><option value="following">People I follow</option><option value="nobody">No one</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-4 py-3">
            <span><span className="block text-[15px] font-medium">Who can send collaboration invitations</span><span className="block text-sm text-muted-foreground">Applies to brand invites to campaigns.</span></span>
            <select className={select} value={me.collab_permission} onChange={(e) => update({ collab_permission: e.target.value })}>
              <option value="everyone">Everyone</option><option value="following">Accounts I follow</option><option value="nobody">No one</option>
            </select>
          </label>
          <Toggle label="Show a contact email on my profile" hint="Your sign-in email is never shown. Add a separate public contact address." checked={me.show_email} onChange={(v) => update({ show_email: v })} />
          {me.show_email && (
            <form className="flex gap-2 pb-3" onSubmit={(e) => { e.preventDefault(); const v = contact.trim(); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { toast.error("Enter a valid email address."); return; } update({ contact_email: v || null }); }}>
              <input aria-label="Public contact email" type="email" className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="partnerships@yourname.com" />
              <button type="submit" className={btnSmPrimary}>Save</button>
            </form>
          )}
        </div>
      </section>
      <section className="px-5 py-6">
        <h2 className={h2}>Blocked accounts</h2>
        {blocked.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">You haven't blocked anyone. Blocked accounts can't message you, follow you or invite you.</p> : (
          <ul className="mt-3 space-y-3">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center gap-3">
                <Avatar src={b.avatar_url} name={b.display_name} size="sm" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{b.display_name}</span><span className="block text-xs text-muted-foreground">@{b.username}</span></span>
                <button type="button" className={btnSmOutline} onClick={() => unblock(b.id)}>Unblock</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

type Prefs = { in_app: boolean; email: boolean; messages: boolean; collaboration: boolean; social: boolean; campaigns: boolean };
const DEFAULT_PREFS: Prefs = { in_app: true, email: false, messages: true, collaboration: true, social: true, campaigns: true };

function NotificationsSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: prefs = DEFAULT_PREFS } = useQuery({
    queryKey: ["prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("notification_preferences").select("in_app, email, messages, collaboration, social, campaigns").eq("user_id", user!.id).maybeSingle();
      return data ?? DEFAULT_PREFS;
    },
  });
  const set = async (k: keyof Prefs, v: boolean) => {
    const next = { ...prefs, [k]: v };
    qc.setQueryData(["prefs", user?.id], next);
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: user!.id, ...next, updated_at: new Date().toISOString() });
    if (error) { toast.error("Couldn't save your preference."); qc.invalidateQueries({ queryKey: ["prefs"] }); }
  };
  return (
    <section className="px-5 py-6">
      <h2 className={h2}>Notifications</h2>
      <div className="mt-2 divide-y">
        <Toggle label="In-app notifications" hint="Turn off to pause everything except security alerts." checked={prefs.in_app} onChange={(v) => set("in_app", v)} />
        <Toggle label="Social activity" hint="Follows, likes, replies, mentions and reposts." checked={prefs.social} onChange={(v) => set("social", v)} />
        <Toggle label="Messages" hint="New direct messages." checked={prefs.messages} onChange={(v) => set("messages", v)} />
        <Toggle label="Campaigns" hint="Invitations, new applications and application decisions." checked={prefs.campaigns} onChange={(v) => set("campaigns", v)} />
        <Toggle label="Collaboration updates" hint="Status changes and task assignments in your workspaces." checked={prefs.collaboration} onChange={(v) => set("collaboration", v)} />
        <Toggle label="Email notifications" hint="Saved for when email sending is switched on — no emails are sent yet." checked={prefs.email} onChange={(v) => set("email", v)} />
      </div>
    </section>
  );
}

function SettingsPage() {
  const { section = "profile" } = Route.useSearch();
  const navigate = useNavigate();
  const { data: me } = useMyProfile();
  return (
    <>
      <PageHeader title="Settings">
        <Tabs value={section} onChange={(s) => navigate({ to: "/settings", search: s === "profile" ? {} : { section: s } })} tabs={[
          { id: "profile", label: "Profile" }, { id: "account", label: "Account" }, { id: "privacy", label: "Privacy" }, { id: "notifications", label: "Notifications" },
        ]} />
      </PageHeader>
      {section === "profile" && (
        <section className={sectionCls}>
          <h2 className={h2}>Edit profile</h2>
          <p className="mb-5 text-sm text-muted-foreground">Changes show on your public profile right away.</p>
          {me && <ProfileForm profile={me} mode="edit" onDone={() => undefined} />}
        </section>
      )}
      {section === "account" && <AccountSection />}
      {section === "privacy" && <PrivacySection />}
      {section === "notifications" && <NotificationsSection />}
    </>
  );
}
