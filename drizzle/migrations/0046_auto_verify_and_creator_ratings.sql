create or replace function public.profiles_insert_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    new.is_demo = false;
    new.engagement_rate = null;
  end if;
  -- Every profile is verified automatically (no minimum requirements for now).
  new.verified = true;
  if not new.is_demo and not exists (select 1 from auth.users where id = new.id) then
    raise exception 'Profiles must belong to a signed-in account.';
  end if;
  return new;
end $$;

select set_config('qola.internal', 'on', true);
update public.v2_profiles set verified = true where verified is distinct from true;
select set_config('qola.internal', 'off', true);

create table public.v2_creator_ratings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.v2_profiles(id) on delete cascade,
  creator_id uuid not null references public.v2_profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, creator_id)
);
grant select, insert, update, delete on public.v2_creator_ratings to authenticated;
grant all on public.v2_creator_ratings to service_role;
alter table public.v2_creator_ratings enable row level security;

create or replace function public.creator_ratings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.v2_profiles where id = new.brand_id and account_type = 'brand') then
    raise exception 'Only brand accounts can rate creators.';
  end if;
  if not exists (select 1 from public.v2_profiles where id = new.creator_id and account_type = 'creator') then
    raise exception 'Only creators can be rated.';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger creator_ratings_guard before insert or update on public.v2_creator_ratings
for each row execute function public.creator_ratings_guard();

create policy "Signed-in users read ratings" on public.v2_creator_ratings for select to authenticated using (true);
create policy "Brands add own ratings" on public.v2_creator_ratings for insert to authenticated with check (brand_id = auth.uid());
create policy "Brands edit own ratings" on public.v2_creator_ratings for update to authenticated using (brand_id = auth.uid()) with check (brand_id = auth.uid());
create policy "Brands delete own ratings" on public.v2_creator_ratings for delete to authenticated using (brand_id = auth.uid());

-- Streak = number of most recent brand ratings in a row that are 4 stars or more.
create or replace function public.creator_rating_summary(_creator uuid)
returns table(average numeric, total bigint, streak integer)
language sql stable security definer set search_path = public as $$
  with r as (
    select rating, row_number() over (order by updated_at desc) rn
    from public.v2_creator_ratings where creator_id = _creator
  )
  select
    (select round(avg(rating)::numeric, 1) from r),
    (select count(*) from r),
    coalesce((select min(rn) - 1 from r where rating < 4), (select count(*) from r))::int
$$;
grant execute on function public.creator_rating_summary(uuid) to authenticated;