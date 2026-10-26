create type public.v2_app_role as enum ('admin', 'moderator', 'user');
create type public.account_type as enum ('creator', 'brand');

create table public.v2_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.v2_app_role not null,
  unique (user_id, role)
);
grant select on public.v2_user_roles to authenticated;
grant all on public.v2_user_roles to service_role;
alter table public.v2_user_roles enable row level security;
create policy "Users read own roles" on public.v2_user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.v2_has_role(_user_id uuid, _role public.v2_app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.v2_user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.v2_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  account_type public.account_type not null default 'creator',
  avatar_url text,
  cover_url text,
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 500),
  location text check (char_length(location) <= 80),
  website text check (char_length(website) <= 200),
  social_links jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  onboarded boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  posts_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.v2_profiles to authenticated;
grant all on public.v2_profiles to service_role;
alter table public.v2_profiles enable row level security;
create policy "Profiles readable by signed-in users" on public.v2_profiles for select to authenticated using (true);
create policy "Users insert own profile" on public.v2_profiles for insert to authenticated with check (id = auth.uid());
create policy "Users update own profile" on public.v2_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger profiles_updated_at before update on public.v2_profiles for each row execute function public.set_updated_at();

create or replace function public.protect_profile_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    new.verified = old.verified;
    new.followers_count = old.followers_count;
    new.following_count = old.following_count;
    new.posts_count = old.posts_count;
  end if;
  return new;
end; $$;
create trigger profiles_protect before update on public.v2_profiles for each row execute function public.protect_profile_fields();

create table public.v2_creator_profiles (
  user_id uuid primary key references public.v2_profiles(id) on delete cascade,
  skills text[] not null default '{}',
  categories text[] not null default '{}',
  portfolio_url text,
  experience_level text,
  collaboration_interests text[] not null default '{}',
  availability text,
  preferred_project_types text[] not null default '{}',
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.v2_creator_profiles to authenticated;
grant all on public.v2_creator_profiles to service_role;
alter table public.v2_creator_profiles enable row level security;
create policy "Creator profiles readable" on public.v2_creator_profiles for select to authenticated using (true);
create policy "Own creator profile insert" on public.v2_creator_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "Own creator profile update" on public.v2_creator_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger creator_profiles_updated_at before update on public.v2_creator_profiles for each row execute function public.set_updated_at();

create table public.v2_brand_profiles (
  user_id uuid primary key references public.v2_profiles(id) on delete cascade,
  industry text,
  company_description text,
  contact_person text,
  campaign_categories text[] not null default '{}',
  target_audience text,
  collaboration_requirements text,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.v2_brand_profiles to authenticated;
grant all on public.v2_brand_profiles to service_role;
alter table public.v2_brand_profiles enable row level security;
create policy "Brand profiles readable" on public.v2_brand_profiles for select to authenticated using (true);
create policy "Own brand profile insert" on public.v2_brand_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "Own brand profile update" on public.v2_brand_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger brand_profiles_updated_at before update on public.v2_brand_profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.v2_profiles (id, display_name, avatar_url, account_type)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), ''), 60),
    new.raw_user_meta_data->>'avatar_url',
    case when coalesce(new.raw_user_meta_data->>'account_type', new.raw_user_meta_data->>'signup_role') = 'brand' then 'brand'::public.account_type else 'creator'::public.account_type end
  )
  on conflict (id) do nothing;
  insert into public.v2_user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
create trigger v2_on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.follows (
  follower_id uuid not null references public.v2_profiles(id) on delete cascade,
  following_id uuid not null references public.v2_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "Follows readable" on public.follows for select to authenticated using (true);
create policy "Follow as self" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "Unfollow as self" on public.follows for delete to authenticated using (follower_id = auth.uid());

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.v2_profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  media jsonb not null default '[]'::jsonb,
  visibility text not null default 'public' check (visibility in ('public', 'followers')),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  repost_count integer not null default 0,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or jsonb_array_length(media) > 0)
);
create index posts_created_idx on public.posts(created_at desc);
create index posts_author_idx on public.posts(author_id, created_at desc);
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "Posts visible to audience" on public.posts for select to authenticated using (
  visibility = 'public' or author_id = auth.uid()
  or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = posts.author_id)
);
create policy "Create own posts" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "Edit own posts" on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Delete own posts" on public.posts for delete to authenticated using (author_id = auth.uid());

create or replace function public.protect_post_counters()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    new.like_count = old.like_count;
    new.comment_count = old.comment_count;
    new.repost_count = old.repost_count;
    new.author_id = old.author_id;
    new.created_at = old.created_at;
    if new.body is distinct from old.body then new.edited_at = now(); end if;
  end if;
  return new;
end; $$;
create trigger posts_protect before update on public.posts for each row execute function public.protect_post_counters();

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.v2_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes(user_id);
grant select, insert, delete on public.likes to authenticated;
grant all on public.likes to service_role;
alter table public.likes enable row level security;
create policy "Likes readable" on public.likes for select to authenticated using (true);
create policy "Like as self" on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "Unlike as self" on public.likes for delete to authenticated using (user_id = auth.uid());

create table public.reposts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.v2_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index reposts_user_idx on public.reposts(user_id);
grant select, insert, delete on public.reposts to authenticated;
grant all on public.reposts to service_role;
alter table public.reposts enable row level security;
create policy "Reposts readable" on public.reposts for select to authenticated using (true);
create policy "Repost as self" on public.reposts for insert to authenticated with check (user_id = auth.uid());
create policy "Undo repost as self" on public.reposts for delete to authenticated using (user_id = auth.uid());

create table public.bookmarks (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.v2_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index bookmarks_user_idx on public.bookmarks(user_id, created_at desc);
grant select, insert, delete on public.bookmarks to authenticated;
grant all on public.bookmarks to service_role;
alter table public.bookmarks enable row level security;
create policy "Own bookmarks only" on public.bookmarks for select to authenticated using (user_id = auth.uid());
create policy "Bookmark as self" on public.bookmarks for insert to authenticated with check (user_id = auth.uid());
create policy "Remove own bookmark" on public.bookmarks for delete to authenticated using (user_id = auth.uid());

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.v2_profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments(post_id, created_at);
grant select, insert, update, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "Comments readable" on public.comments for select to authenticated using (true);
create policy "Comment as self" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "Edit own comments" on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Delete own comments" on public.comments for delete to authenticated using (author_id = auth.uid());

create or replace function public.bump_counters()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d integer;
  r record;
begin
  if tg_op = 'INSERT' then d := 1; r := new; else d := -1; r := old; end if;
  perform set_config('qola.internal', 'on', true);
  if tg_table_name = 'likes' then
    update public.posts set like_count = greatest(like_count + d, 0) where id = r.post_id;
  elsif tg_table_name = 'reposts' then
    update public.posts set repost_count = greatest(repost_count + d, 0) where id = r.post_id;
  elsif tg_table_name = 'comments' then
    update public.posts set comment_count = greatest(comment_count + d, 0) where id = r.post_id;
  elsif tg_table_name = 'posts' then
    update public.v2_profiles set posts_count = greatest(posts_count + d, 0) where id = r.author_id;
  elsif tg_table_name = 'follows' then
    update public.v2_profiles set followers_count = greatest(followers_count + d, 0) where id = r.following_id;
    update public.v2_profiles set following_count = greatest(following_count + d, 0) where id = r.follower_id;
  end if;
  perform set_config('qola.internal', 'off', true);
  return null;
end; $$;
create trigger likes_count after insert or delete on public.likes for each row execute function public.bump_counters();
create trigger reposts_count after insert or delete on public.reposts for each row execute function public.bump_counters();
create trigger comments_count after insert or delete on public.comments for each row execute function public.bump_counters();
create trigger posts_count after insert or delete on public.posts for each row execute function public.bump_counters();
create trigger follows_count after insert or delete on public.follows for each row execute function public.bump_counters();

create policy "Signed-in read media" on storage.objects for select to authenticated using (bucket_id = 'media');
create policy "Upload own media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Delete own media" on storage.objects for delete to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);