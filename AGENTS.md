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

- Keep content pages in TanStack file routes, shared account state in AccountProvider, and pure marketplace examples and scoring in browser-safe library modules; this preserves deep links and SSR safety.
- Persist private briefs, shortlists and account details in Cloud under owner RLS, and keep privileged roles in user_roles; never restore the source's client-selected admin access.
- Use semantic global CSS tokens and shared Button controls for the marketplace redesign so presentation stays consistent.
- Initialize matching directory rows in the account lifecycle and rank all candidates, including low-overlap discovery suggestions, so new accounts never depend on a second onboarding save.
- Enforce brand business-email and email-provider requirements in account lifecycle functions as well as the sign-in UI, so hidden controls cannot bypass account creation rules.
- Social feed identities live in feed_profiles (demo rows have no login; members get one via ensure_feed_profile), so demo accounts never need real auth users.
- AI creator orders are created and advanced only through server functions in src/lib/orders.functions.ts (prices looked up server-side, brand role checked); ai_orders has owner read RLS and no client write grants, so brands can't set their own price or status.
- Creator verification status changes only through server functions in src/lib/verification.functions.ts (requests, AI reports and audit logs have no client write grants); eligibility rules live in src/lib/verification.ts so reviewers, not the AI or the creator, control the Verified badge.
- Feed UI (sidebar, rail, post list, optimistic social toggles) lives in src/components/feed-kit.tsx and is shared by /home and /p/$handle, so feed and profile pages behave identically.
- Resolve OAuth signup intent in a browser-safe helper while enforcing provider eligibility and permanent account types in choose_signup_role; this keeps redirects testable without trusting client role hints for access.
