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
