# Replace the site with the uploaded Qolabrate (keep data, keep sign-in page)

## What you'll get
- The uploaded site becomes the whole signed-in app: Feed (text, photo, video posts), Explore, Creators, AI Creators and AI orders, Campaigns (create, edit, apply), Collaborate workspace (milestones, tasks, deliverables, files), Messages with files, Notifications, Email inbox, Shortlists, Bookmarks, Billing, Settings, Admin, public profiles, post pages.
- Its public pages too: homepage, About, Features, Contact, Discover, For Brands.
- Its demo content (demo profiles, posts, campaigns and the demo media library).
- Your current sign-in / sign-up page stays exactly as it is, including the Creator / Brand choice, company-email rule for brands, and Google / Microsoft buttons. The uploaded site's own sign-in and join pages send people to it.
- After sign-in, new members complete the uploaded site's profile setup once, then the feed opens.
- arjunbablu333@gmail.com keeps admin access.

## What happens to current data
- Nothing is deleted. Current posts, campaigns, collabs, messages, orders and demo accounts stay saved in the background but are no longer shown.
- Everyone's login keeps working. Existing members set up their profile again the first time they sign in to the new app; their Creator / Brand type is carried over and stays locked.

## Stages
1. Database: create the uploaded site's tables next to the current ones. Where a name clashes (profiles, campaigns, applications, AI orders, brand and creator profiles, notifications, portfolio, shortlists, roles, subscriptions) the new table gets a separate name, so old data is untouched. Security rules copied from the uploaded site.
2. Code: bring in the uploaded pages, components and server logic; point them at the new table names; replace the old pages with the same addresses.
3. Sign-in bridge: keep the current sign-in page, carry each member's Creator / Brand type into the new app, route signed-in members to profile setup or the feed.
4. Demo data and media: load the uploaded demo content and images.
5. Checks: run the uploaded site's tests plus existing sign-in tests, then test sign-up, profile setup, feed, posting, messaging and campaigns in a browser.

## Technical details
- Clashing tables are created with a `v2_` prefix; the imported code's `.from(...)`, RPC SQL and RLS are rewritten to match. Non-clashing tables keep their names. Clashing enum/function names are suffixed the same way.
- Old routes replaced by imported routes at the same paths; `src/routes/auth.tsx` and its helpers (oauth-role, business-email, choose_signup_role) are kept; imported `/signin` and `/join` redirect to `/auth`.
- `choose_signup_role` additionally upserts the role into the new roles table; a migration backfills roles for existing users.
- Imported AI features (orders, video) use the Lovable AI Gateway server-side; any extra keys are requested securely only if needed.
- This is large and runs across several messages; each stage is checked before the next.
