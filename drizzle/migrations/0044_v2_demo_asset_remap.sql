create table if not exists public.demo_asset_map (
  old_url text primary key,
  new_url text not null
);
grant all on public.demo_asset_map to service_role;
alter table public.demo_asset_map enable row level security;

-- Swaps demo picture addresses from the uploaded site for this site's own copies.
create or replace function public.demo_remap_assets()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; c int;
begin
  perform set_config('qola.internal', 'on', true);
  for r in select old_url, new_url from public.demo_asset_map loop
    update public.posts set media = replace(media::text, r.old_url, r.new_url)::jsonb where media::text like '%' || r.old_url || '%';
    get diagnostics c = row_count; n := n + c;
    update public.v2_profiles set avatar_url = r.new_url where avatar_url = r.old_url;
    update public.v2_profiles set cover_url = r.new_url where cover_url = r.old_url;
    update public.ai_creators set avatar_url = r.new_url where avatar_url = r.old_url;
    update public.ai_creators set portfolio = replace(portfolio::text, r.old_url, r.new_url)::jsonb where portfolio::text like '%' || r.old_url || '%';
    update public.demo_library set data = replace(data::text, r.old_url, r.new_url)::jsonb where data::text like '%' || r.old_url || '%';
  end loop;
  perform set_config('qola.internal', 'off', true);
  return n;
end $$;
revoke all on function public.demo_remap_assets() from public, anon, authenticated;

create or replace function public.seed_demo_content()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare result jsonb;
begin
  if auth.uid() is not null and not public.v2_has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can seed demo content.';
  end if;
  result := public.seed_demo_content_base();
  result := result || jsonb_build_object('deduplicated', public.dedupe_demo_posts(), 'creator_details', public.demo_fill_creator_details());
  perform public.demo_remap_assets();
  return result || jsonb_build_object('library', public.demo_apply_library(), 'remapped', public.demo_remap_assets());
end $$;