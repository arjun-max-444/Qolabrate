alter function public.seed_demo_content() rename to seed_demo_content_base;
revoke execute on function public.seed_demo_content_base() from public, anon, authenticated;

create or replace function public.demo_sentence_case(_t text)
returns text language plpgsql immutable set search_path = public as $$
declare res text := ''; i int; ch text; cap boolean := true;
begin
  if _t is null then return null; end if;
  for i in 1..char_length(_t) loop
    ch := substr(_t, i, 1);
    if cap and ch ~ '[a-z]' then
      res := res || upper(ch); cap := false;
    else
      res := res || ch;
      if cap and ch ~ '\S' then cap := false; end if;
    end if;
    if ch in ('.', '!', '?') then cap := true; end if;
  end loop;
  return res;
end $$;

create or replace function public.dedupe_demo_posts()
returns int language plpgsql security definer set search_path = public as $$
declare
  creator_suffix text[] := array['Full breakdown in the comments.','What would you add?','Save this for later.','More on this soon.','Tell me your take below.','Part two this weekend.','Questions welcome.','Who else has tried this?','Would you try it?','Sharing what worked for me.','Let me know if this helps.','Shot this on a slow Sunday.','Thanks for all the love on the last one.','Took me a while to get this right.','DM-worthy? Send it to a friend.','Still thinking about this one.'];
  brand_suffix text[] := array['Free shipping over ₹499.','Available on our website and app.','Limited stock, grab yours early.','Made with care in India.','Tag us when you try it.','Easy 7-day returns.','Now live in 20+ cities.','Built with feedback from our community.','Questions? Our team replies within a day.','Creators, our DMs are open.','Cash on delivery available.','Gift-ready packaging included.'];
  r record; pass int; total int := 0; changed int;
begin
  perform set_config('qola.internal', 'on', true);
  update public.posts set body = public.demo_sentence_case(body) where is_demo and body <> public.demo_sentence_case(body);
  for pass in 1..6 loop
    changed := 0;
    for r in
      select id, body, post_type, row_number() over (partition by body order by created_at, id) rn
      from public.posts where is_demo
    loop
      if r.rn > 1 then
        perform set_config('qola.internal', 'on', true);
        update public.posts set body = left(regexp_replace(r.body, E'\n\n',
          ' ' || case when r.post_type in ('promotion','collab')
            then brand_suffix[1 + public.demo_hash('bs' || r.id || pass, 12)]
            else creator_suffix[1 + public.demo_hash('cs' || r.id || pass, 16)] end || E'\n\n'), 1000)
        where id = r.id;
        changed := changed + 1;
      end if;
    end loop;
    total := total + changed;
    exit when changed = 0;
  end loop;
  perform set_config('qola.internal', 'off', true);
  return total;
end $$;
revoke execute on function public.dedupe_demo_posts() from public, anon, authenticated;

create or replace function public.seed_demo_content()
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if auth.uid() is not null and not public.v2_has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can seed demo content.';
  end if;
  result := public.seed_demo_content_base();
  return result || jsonb_build_object('deduplicated', public.dedupe_demo_posts());
end $$;
revoke execute on function public.seed_demo_content() from public, anon;
grant execute on function public.seed_demo_content() to authenticated;