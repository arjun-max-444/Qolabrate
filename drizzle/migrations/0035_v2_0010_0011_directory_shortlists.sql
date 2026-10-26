create or replace function public.require_verified_publisher()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if tg_op = 'UPDATE' and old.moderation_note is not null and old.status in ('cancelled','paused') and new.status <> old.status then
    raise exception 'This campaign was % by the Qolabrate team. Contact us to restore it.', case old.status when 'cancelled' then 'removed' else 'paused' end;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') and not public.is_verified(new.brand_id) then
    raise exception 'Only verified brands can publish campaigns. Request verification in Settings.';
  end if;
  new.moderation_note = case when tg_op = 'UPDATE' then old.moderation_note else null end;
  return new;
end $$;

ALTER TABLE public.v2_creator_profiles
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_size integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS rate_min integer,
  ADD COLUMN IF NOT EXISTS rate_max integer,
  ADD COLUMN IF NOT EXISTS metrics_confirmed_at timestamptz;

ALTER TABLE public.v2_creator_profiles
  ADD CONSTRAINT creator_profiles_rate_range CHECK (
    (rate_min IS NULL OR (rate_min >= 0 AND rate_min <= 100000000))
    AND (rate_max IS NULL OR (rate_max >= 0 AND rate_max <= 100000000))
    AND (rate_min IS NULL OR rate_max IS NULL OR rate_min <= rate_max)),
  ADD CONSTRAINT creator_profiles_engagement_range CHECK (engagement_rate IS NULL OR (engagement_rate >= 0 AND engagement_rate <= 100));

CREATE INDEX IF NOT EXISTS creator_profiles_categories_idx ON public.v2_creator_profiles USING gin (categories);
CREATE INDEX IF NOT EXISTS creator_profiles_languages_idx ON public.v2_creator_profiles USING gin (languages);
CREATE INDEX IF NOT EXISTS creator_profiles_audience_idx ON public.v2_creator_profiles (audience_size DESC);

CREATE OR REPLACE FUNCTION public.creator_profiles_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
declare
  internal boolean := coalesce(current_setting('qola.internal', true), 'off') = 'on';
  total numeric := 0; item jsonb;
  allowed_platforms text[] := array['instagram','youtube','x','linkedin','facebook','threads','snapchat','other'];
  allowed_types text[] := array['reels','shorts','long_video','photos','stories','ugc','blogs','livestream','podcasts','ai_video'];
begin
  if jsonb_typeof(new.platforms) <> 'array' then raise exception 'Platforms must be a list.'; end if;
  if jsonb_array_length(new.platforms) > 8 then raise exception 'Add up to 8 platforms.'; end if;
  for item in select value from jsonb_array_elements(new.platforms) loop
    if jsonb_typeof(item) <> 'object' or not coalesce(item->>'platform' = any(allowed_platforms), false) then
      raise exception 'Unknown platform.';
    end if;
    if item ? 'followers' and jsonb_typeof(item->'followers') <> 'null' then
      if jsonb_typeof(item->'followers') <> 'number' or (item->>'followers')::numeric < 0 or (item->>'followers')::numeric > 2000000000 then
        raise exception 'Audience size must be a whole number.';
      end if;
      total := total + floor((item->>'followers')::numeric);
    end if;
    if char_length(coalesce(item->>'handle', '')) > 100 then raise exception 'Platform handle is too long.'; end if;
  end loop;
  if (select count(distinct value->>'platform') from jsonb_array_elements(new.platforms)) <> jsonb_array_length(new.platforms) then
    raise exception 'Add each platform only once.';
  end if;
  new.audience_size := least(total, 2147483647)::int;
  if cardinality(new.languages) > 10 then raise exception 'Add up to 10 languages.'; end if;
  if exists (select 1 from unnest(new.languages) l where char_length(l) > 30) then raise exception 'Language name is too long.'; end if;
  if not (new.content_types <@ allowed_types) then raise exception 'Unknown content type.'; end if;

  if not internal then
    if tg_op = 'INSERT' then
      new.metrics_confirmed_at := null;
    else
      new.metrics_confirmed_at := old.metrics_confirmed_at;
      if new.platforms is distinct from old.platforms or new.engagement_rate is distinct from old.engagement_rate then
        new.metrics_confirmed_at := null;
      end if;
    end if;
  end if;
  if exists (select 1 from public.v2_profiles where id = new.user_id and is_demo) then new.metrics_confirmed_at := null; end if;
  return new;
end $$;

DROP TRIGGER IF EXISTS creator_profiles_guard ON public.v2_creator_profiles;
CREATE TRIGGER creator_profiles_guard BEFORE INSERT OR UPDATE ON public.v2_creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.creator_profiles_guard();

CREATE OR REPLACE FUNCTION public.admin_confirm_metrics(_user uuid, _confirm boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Only admins can confirm creator metrics.'; end if;
  if exists (select 1 from public.v2_profiles where id = _user and is_demo) then raise exception 'Demo profiles can''t have confirmed metrics.'; end if;
  if _confirm and not exists (select 1 from public.v2_creator_profiles where user_id = _user and jsonb_array_length(platforms) > 0) then
    raise exception 'This creator hasn''t added any platform audience yet.';
  end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_creator_profiles set metrics_confirmed_at = case when _confirm then now() else null end where user_id = _user;
  perform set_config('qola.internal', 'off', true);
  perform public.audit(case when _confirm then 'metrics_confirmed' else 'metrics_unconfirmed' end, 'profile', _user, _reason);
end $$;
REVOKE ALL ON FUNCTION public.admin_confirm_metrics(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_metrics(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_creators(
  _q text DEFAULT NULL, _niche text DEFAULT NULL, _location text DEFAULT NULL, _max_rate integer DEFAULT NULL,
  _platform text DEFAULT NULL, _min_audience integer DEFAULT NULL, _min_engagement numeric DEFAULT NULL,
  _content_type text DEFAULT NULL, _language text DEFAULT NULL, _verified_only boolean DEFAULT false,
  _available_only boolean DEFAULT false, _sort text DEFAULT 'audience', _offset integer DEFAULT 0, _limit integer DEFAULT 20)
RETURNS TABLE(
  id uuid, username text, display_name text, avatar_url text, headline text, bio text, location text,
  verified boolean, is_demo boolean, followers_count integer, categories text[], skills text[], languages text[],
  content_types text[], platforms jsonb, audience_size integer, engagement_rate numeric, rate_min integer, rate_max integer,
  availability text, portfolio_url text, metrics_confirmed boolean, portfolio_count integer)
LANGUAGE sql STABLE SET search_path = public AS $$
  select p.id, p.username, p.display_name, p.avatar_url, p.headline, p.bio, p.location,
    p.verified, p.is_demo, p.followers_count, coalesce(cp.categories, '{}'), coalesce(cp.skills, '{}'), coalesce(cp.languages, '{}'),
    coalesce(cp.content_types, '{}'), coalesce(cp.platforms, '[]'::jsonb), coalesce(cp.audience_size, 0), cp.engagement_rate, cp.rate_min, cp.rate_max,
    cp.availability, cp.portfolio_url, cp.metrics_confirmed_at is not null,
    (select count(*)::int from public.v2_portfolio_items pi where pi.owner_id = p.id)
  from public.v2_profiles p
  left join public.v2_creator_profiles cp on cp.user_id = p.id
  where auth.uid() is not null
    and p.account_type = 'creator' and p.onboarded and p.suspended_at is null and p.username is not null
    and not public.is_blocked_between(auth.uid(), p.id)
    and (coalesce(btrim(_q), '') = '' or p.display_name ilike '%' || btrim(_q) || '%' or p.username ilike '%' || btrim(_q) || '%'
         or p.headline ilike '%' || btrim(_q) || '%' or p.bio ilike '%' || btrim(_q) || '%'
         or exists (select 1 from unnest(cp.skills) s where s ilike '%' || btrim(_q) || '%'))
    and (_niche is null or _niche = any(cp.categories))
    and (coalesce(btrim(_location), '') = '' or p.location ilike '%' || btrim(_location) || '%')
    and (_max_rate is null or cp.rate_min <= _max_rate)
    and (_platform is null or cp.platforms @> jsonb_build_array(jsonb_build_object('platform', _platform)))
    and (_min_audience is null or cp.audience_size >= _min_audience)
    and (_min_engagement is null or cp.engagement_rate >= _min_engagement)
    and (_content_type is null or _content_type = any(cp.content_types))
    and (_language is null or _language = any(cp.languages))
    and (not coalesce(_verified_only, false) or p.verified)
    and (not coalesce(_available_only, false) or cp.availability ilike 'open%')
  order by
    case when _sort = 'engagement' then cp.engagement_rate end desc nulls last,
    case when _sort = 'rate_low' then cp.rate_min end asc nulls last,
    case when _sort = 'newest' then p.created_at end desc,
    cp.audience_size desc nulls last, p.followers_count desc, p.id
  offset greatest(coalesce(_offset, 0), 0) limit least(greatest(coalesce(_limit, 20), 1), 50)
$$;
REVOKE ALL ON FUNCTION public.search_creators(text, text, text, integer, text, integer, numeric, text, text, boolean, boolean, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_creators(text, text, text, integer, text, integer, numeric, text, text, boolean, boolean, text, integer, integer) TO authenticated;

CREATE TABLE public.v2_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.v2_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);
CREATE TABLE public.shortlist_items (
  shortlist_id uuid NOT NULL REFERENCES public.v2_shortlists(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.v2_profiles(id) ON DELETE CASCADE,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shortlist_id, creator_id)
);
CREATE INDEX shortlist_items_creator_idx ON public.shortlist_items (creator_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_shortlists TO authenticated;
GRANT ALL ON public.v2_shortlists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shortlist_items TO authenticated;
GRANT ALL ON public.shortlist_items TO service_role;

CREATE OR REPLACE FUNCTION public.owns_shortlist(_list uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.v2_shortlists where id = _list and owner_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.shortlists_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  new.name := btrim(new.name);
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.v2_profiles where id = new.owner_id and account_type = 'brand') then
      raise exception 'Only brand accounts can create shortlists.';
    end if;
    if (select count(*) from public.v2_shortlists where owner_id = new.owner_id) >= 50 then
      raise exception 'You can have up to 50 shortlists.';
    end if;
    new.created_at := now();
  else
    new.owner_id := old.owner_id; new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
CREATE TRIGGER shortlists_guard BEFORE INSERT OR UPDATE ON public.v2_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.shortlists_guard();

CREATE OR REPLACE FUNCTION public.shortlist_items_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare owner uuid;
begin
  select owner_id into owner from public.v2_shortlists where id = new.shortlist_id;
  if tg_op = 'UPDATE' then
    new.shortlist_id := old.shortlist_id; new.creator_id := old.creator_id; new.added_at := old.added_at;
    return new;
  end if;
  if not exists (select 1 from public.v2_profiles where id = new.creator_id and account_type = 'creator') then
    raise exception 'Only creators can be added to a shortlist.';
  end if;
  if public.is_blocked_between(owner, new.creator_id) then raise exception 'You can''t interact with this account.'; end if;
  if (select count(*) from public.shortlist_items where shortlist_id = new.shortlist_id) >= 500 then
    raise exception 'A shortlist can hold up to 500 creators.';
  end if;
  new.added_at := now();
  return new;
end $$;
CREATE TRIGGER shortlist_items_guard BEFORE INSERT OR UPDATE ON public.shortlist_items
  FOR EACH ROW EXECUTE FUNCTION public.shortlist_items_guard();

ALTER TABLE public.v2_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads shortlists" ON public.v2_shortlists FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner creates shortlists" ON public.v2_shortlists FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner updates shortlists" ON public.v2_shortlists FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner deletes shortlists" ON public.v2_shortlists FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Owner reads shortlist items" ON public.shortlist_items FOR SELECT TO authenticated USING (public.owns_shortlist(shortlist_id, auth.uid()));
CREATE POLICY "Owner adds shortlist items" ON public.shortlist_items FOR INSERT TO authenticated WITH CHECK (public.owns_shortlist(shortlist_id, auth.uid()));
CREATE POLICY "Owner updates shortlist items" ON public.shortlist_items FOR UPDATE TO authenticated USING (public.owns_shortlist(shortlist_id, auth.uid())) WITH CHECK (public.owns_shortlist(shortlist_id, auth.uid()));
CREATE POLICY "Owner removes shortlist items" ON public.shortlist_items FOR DELETE TO authenticated USING (public.owns_shortlist(shortlist_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.demo_fill_creator_details()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n integer;
begin
  if auth.uid() is not null and not public.v2_has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can seed demo content.';
  end if;
  insert into public.v2_creator_profiles (user_id)
    select id from public.v2_profiles where is_demo and account_type = 'creator'
    on conflict (user_id) do nothing;
  update public.v2_creator_profiles cp set
    languages = array['English', (array['Hindi','Tamil','Telugu','Bengali','Marathi','Kannada','Malayalam','Gujarati','Punjabi'])[1 + public.demo_hash(p.id::text || ':lang', 9)]],
    content_types = (array['reels','shorts','long_video','photos','stories','ugc','blogs','livestream','podcasts','ai_video'])[1 + public.demo_hash(p.id::text || ':ct1', 5) : 3 + public.demo_hash(p.id::text || ':ct1', 5) + public.demo_hash(p.id::text || ':ct2', 2)],
    platforms = case
      when public.demo_hash(p.id::text || ':pf', 3) = 0 then jsonb_build_array(
        jsonb_build_object('platform', 'instagram', 'followers', (p.followers_count * 0.7)::int),
        jsonb_build_object('platform', 'youtube', 'followers', (p.followers_count * 0.3)::int))
      when public.demo_hash(p.id::text || ':pf', 3) = 1 then jsonb_build_array(
        jsonb_build_object('platform', 'youtube', 'followers', (p.followers_count * 0.8)::int),
        jsonb_build_object('platform', 'x', 'followers', (p.followers_count * 0.2)::int))
      else jsonb_build_array(
        jsonb_build_object('platform', 'instagram', 'followers', (p.followers_count * 0.85)::int),
        jsonb_build_object('platform', 'linkedin', 'followers', (p.followers_count * 0.15)::int))
    end,
    engagement_rate = coalesce(p.engagement_rate, 1.5 + public.demo_hash(p.id::text || ':er', 50) / 10.0),
    rate_min = greatest(3000, (round(p.followers_count / 15.0 / 1000) * 1000)::int),
    rate_max = greatest(3000, (round(p.followers_count / 15.0 / 1000) * 1000)::int) * 2
  from public.v2_profiles p
  where p.id = cp.user_id and p.is_demo and p.account_type = 'creator';
  get diagnostics n = row_count;
  return n;
end $$;
REVOKE ALL ON FUNCTION public.demo_fill_creator_details() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.seed_demo_content()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare result jsonb;
begin
  if auth.uid() is not null and not public.v2_has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can seed demo content.';
  end if;
  result := public.seed_demo_content_base();
  return result || jsonb_build_object('deduplicated', public.dedupe_demo_posts(), 'creator_details', public.demo_fill_creator_details());
end $$;