<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- `/` is the public marketing landing (`src/components/landing/`); signed-in visitors go to `/home`. Why: front door stays separate from the app.
- Signed-in pages live under `src/routes/_authenticated/_shell/` inside `AppShell`; the `_shell` layout sends un-onboarded users to `/onboarding`. Why: one gate, one layout.
- App data is read/written from the browser with the generated client under RLS; counters, notifications (`notify()` with dedupe key) and activity logs are written only by database triggers/functions. Why: no duplicated logic, nothing forgeable.
- Business rules live in the database; `src/lib/catalog.ts`, `campaigns.ts`, `creators.ts` and `orders.ts` only mirror them for the UI. Why: rules hold even if the UI is bypassed.
- Files: post/profile media in private `media` bucket under `<userId>/...` as long-lived signed links (public buckets are blocked); message/collab/order files in private `private` bucket opened with 1-hour signed links (`src/lib/files.ts`). Why: shared media visible to members, private files only to participants.
- Email records never reach Sent status from the browser; only a future server-side sender may set it. Why: never report undelivered email as sent.
- `roadmap.md` tracks the phased build. Why: the brief is too large for one pass.
- Demo and AI-creator images are Lovable CDN assets referenced by relative URL (pointers in `src/assets/demo/`, `src/assets/ai-creators/`; per-account/per-post demo images listed in `src/data/demo-library.json`). Why: no binaries in the repo.
- Account roles: one Creator or Brand role per login, chosen at onboarding via `choose_account_type` and then locked (`role_locked_at`, `account_type_guard`); only `admin_change_account_type` (reason + audit) changes it. `is_creator`/`is_brand` gate posts (any chosen role), campaigns, AI orders, shortlists and billing (brands only); feeds show creator and brand posts; brand-only pages are listed in `src/lib/roles.ts` and blocked in the `_shell` layout. Role events and blocked attempts go to `account_events`. AI creators stay platform-run personas for brand orders. Why: strict creator/brand separation enforced by the database.
- Payments are simulated (`provider = 'simulated'`), created only by database functions, and the UI always says "Simulated". A real provider must replace `simulate_payment`/`pay_charge`/`change_plan` and verify payment server-side. Why: never claim money moved without provider confirmation.
- AI generation runs only in `src/routes/api/orders.generate.ts` and `orders.video.ts` (both check the caller owns the order via `src/lib/order-auth.server.ts`, then use the service key); gateway calls live in `src/lib/ai-gateway.server.ts` and `ai-video.server.ts`. Videos are async jobs in `ai_video_jobs`, rendered one at a time and advanced by the order page polling; each finished MP4 is stored in the private bucket immediately (gateway links expire). Why: keys stay server-side and long renders don't exceed request limits.

## Database rules
- Demo data: normal tables flagged `is_demo`, created only by `seed_demo_content()` (fixed ids, on-conflict-skip; `clear_demo_content()` removes it); profile details, images, moved/extra posts come from `src/data/demo-library.json`, synced by the admin-only `syncDemoLibrary` into `demo_library` and applied by `demo_apply_library()`. Demo profiles have no account, so `profiles` has no FK to auth users; a guard requires real profiles to match an account. Why: sample data stays separate and removable.
- `is_demo`, `verified`, counters change only inside functions setting `qola.internal`; demo profiles never get notifications; messages to them get one `demo_auto_reply` trigger reply flagged `is_automated` (only settable internally) and labelled in the UI. Why: no faked status or fake people.
- Posting, campaigns and offers require `profiles.verified`; admin decisions go only through `admin_*` functions that check the role and write read-only `admin_audit_log`; suspension is enforced by `block_suspended` and `is_verified()`. Why: accountable moderation that holds without the UI.
- Signed-out visitors read only via `public_feed`/`public_campaigns`. Why: no private columns exposed.
- Legacy human-creator rules (metrics confirmed only by `admin_confirm_metrics`, owner-only shortlists, `applications_guard`/`workspace_guard`, `start_campaign_conversation`) stay in force for old data.
- AI orders: `ai_campaigns` -> `compute_matches` -> `ai_orders` (offer + order) -> versioned `ai_order_assets`, history in `ai_order_events`. Status moves only via security-definer functions (`send_offer`, `confirm_order`, `simulate_payment`, `request_revision`, `approve_content`, `complete_order`, `cancel_order`, `admin_refund_order`); `ai_orders_guard` allows editing draft terms only and re-snapshots price from `platform_settings`. Overspend, duplicate open orders and duplicate payments are blocked. Generation functions are service-role only; order files live at `private/order/<orderId>/v<version>/...`. Why: prices, approvals and content can't be forged.


## Import rules (side-by-side with the earlier site)
- The earlier site's tables stay untouched; tables/functions from the imported app that clashed are prefixed `v2_` (e.g. `v2_profiles`, `v2_campaigns`, `v2_has_role`). Why: breaking migrations are not allowed, so old data is kept rather than dropped. Code and SQL references to clashing names must use the `v2_` form.
- The sign-in/sign-up page is the earlier `/auth` route (with its email, Google and Microsoft rules); `/signin` and `/join` redirect to it, and it routes by `v2_profiles.onboarded` to `/onboarding` or `/home`. Old role helpers live in `src/lib/legacy-roles.ts`. Why: user asked to keep the authentication page unchanged.
- Old CDN media URLs are mapped to this project's assets via `demo_asset_map` + `demo_remap_assets()` (service-role only), which `seed_demo_content()` calls. Why: the import's images pointed to another project and 404'd.
