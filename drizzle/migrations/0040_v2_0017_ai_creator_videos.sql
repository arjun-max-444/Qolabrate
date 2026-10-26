alter table public.ai_campaigns add column if not exists video_count integer not null default 0;
alter table public.v2_ai_orders add column if not exists video_count integer not null default 0;
alter table public.ai_creator_packages add column if not exists video_count integer not null default 0;
alter table public.ai_campaigns add constraint ai_campaigns_video_count_check check (video_count between 0 and 2);
alter table public.v2_ai_orders add constraint ai_orders_video_count_check check (video_count between 0 and 2);
alter table public.ai_creator_packages add constraint ai_creator_packages_video_count_check check (video_count between 0 and 2);

alter table public.platform_settings add column if not exists video_cost_estimate integer not null default 40;
alter table public.platform_settings add constraint platform_settings_video_cost_estimate_check check (video_cost_estimate >= 0);

alter table public.ai_order_assets drop constraint ai_order_assets_kind_check;
alter table public.ai_order_assets add constraint ai_order_assets_kind_check check (kind = any (array['image','caption','script','video']));

create or replace function public.generation_window(_videos integer) returns interval
language sql immutable set search_path = public
as $$ select interval '15 minutes' + interval '15 minutes' * greatest(coalesce(_videos, 0), 0) $$;

create table public.ai_video_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.v2_ai_orders(id) on delete cascade,
  version integer not null,
  position integer not null,
  prompt text not null,
  gateway_job_id text,
  status text not null default 'pending' check (status in ('pending','starting','running','saving','done')),
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, version, position)
);
grant select on public.ai_video_jobs to authenticated;
grant all on public.ai_video_jobs to service_role;
alter table public.ai_video_jobs enable row level security;
create policy "Brands read own video jobs" on public.ai_video_jobs for select to authenticated
  using (public.is_order_brand(order_id, auth.uid()) or public.is_staff(auth.uid()));

drop function if exists public.finish_generation(uuid, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.ai_campaigns_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me public.v2_profiles; plan public.subscription_plans; recent integer; u text;
begin
  if tg_op = 'INSERT' then
    select * into me from public.v2_profiles where id = new.brand_id;
    if me.account_type <> 'brand' then raise exception 'Only brand accounts can create campaigns.'; end if;
    if not public.is_verified(new.brand_id) then raise exception 'Get your brand verified before creating campaigns.'; end if;
    plan := public.brand_plan(new.brand_id);
    if plan.campaign_limit is not null then
      select count(*) into recent from public.ai_campaigns where brand_id = new.brand_id and created_at > now() - interval '30 days';
      if recent >= plan.campaign_limit then
        raise exception 'Your % plan allows % campaigns per 30 days. Upgrade in Billing to add more.', plan.name, plan.campaign_limit;
      end if;
    end if;
    new.created_at = now();
  else
    new.brand_id = old.brand_id; new.created_at = old.created_at;
  end if;
  new.name = btrim(new.name); new.product_description = btrim(new.product_description); new.target_audience = btrim(new.target_audience);
  if length(new.name) not between 3 and 120 then raise exception 'Campaign name must be 3–120 characters.'; end if;
  if length(new.product_description) not between 10 and 2000 then raise exception 'Describe the product in 10–2,000 characters.'; end if;
  if new.objective not in ('awareness','engagement','launch','sales','ugc') then raise exception 'Choose a marketing objective.'; end if;
  if length(new.target_audience) not between 3 and 300 then raise exception 'Describe the target audience (3–300 characters).'; end if;
  if new.budget < 1000 or new.budget > 5000000 then raise exception 'Budget must be between ₹1,000 and ₹50,00,000.'; end if;
  if new.image_count not between 0 and 6 or new.caption_count not between 0 and 6 or new.script_count not between 0 and 2 or new.video_count not between 0 and 2 then
    raise exception 'Up to 6 images, 6 captions, 2 scripts and 2 videos per campaign.';
  end if;
  if new.image_count + new.caption_count + new.script_count + new.video_count = 0 then raise exception 'Ask for at least one piece of content.'; end if;
  if (tg_op = 'INSERT' or new.deadline is distinct from old.deadline) and new.deadline < current_date + 2 then
    raise exception 'The delivery deadline must be at least 2 days from today.';
  end if;
  if new.revision_allowance not between 0 and 5 then raise exception 'Revision allowance must be 0–5.'; end if;
  if new.usage_months not between 1 and 36 then raise exception 'Usage rights can run 1–36 months.'; end if;
  if length(coalesce(new.instructions, '')) > 3000 then raise exception 'Instructions are limited to 3,000 characters.'; end if;
  if cardinality(new.reference_urls) > 5 then raise exception 'Add up to 5 reference links.'; end if;
  foreach u in array new.reference_urls loop
    if u !~ '^https://[^\s]{3,500}$' then raise exception 'Reference links must start with https://'; end if;
  end loop;
  new.updated_at = now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.ai_orders_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare c public.ai_campaigns; p public.ai_creator_packages; keep public.v2_ai_orders;
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then new.updated_at = now(); return new; end if;
  if tg_op = 'INSERT' then
    if new.brand_id is distinct from auth.uid() then raise exception 'Orders belong to the signed-in brand.'; end if;
    if not public.is_verified(new.brand_id) then raise exception 'Get your brand verified before creating offers.'; end if;
    select * into c from public.ai_campaigns where id = new.campaign_id;
    if not found or c.brand_id <> new.brand_id then raise exception 'Campaign not found.'; end if;
    if c.status <> 'active' then raise exception 'This campaign is archived.'; end if;
    select * into p from public.ai_creator_packages where id = new.package_id;
    if not found or p.creator_id <> new.creator_id or not p.active then raise exception 'Choose an available package from this creator.'; end if;
    if not exists (select 1 from public.ai_creators where id = new.creator_id and active) then raise exception 'This AI creator is not available.'; end if;
    new.status := 'draft'; new.decision_reason := null; new.revisions_used := 0; new.current_version := 0;
    new.last_feedback := null; new.generating_since := null; new.generation_cost_estimate := 0; new.payment_fee := 0;
    new.sent_at := null; new.decided_at := null; new.confirmed_at := null; new.paid_at := null; new.production_started_at := null;
    new.ready_at := null; new.approved_at := null; new.completed_at := null; new.cancelled_at := null;
    new.created_at := now();
    new := public.ai_orders_snapshot_price(new);
  else
    if old.status <> 'draft' then raise exception 'Only draft offers can be edited.'; end if;
    keep := old;
    keep.image_count := new.image_count; keep.caption_count := new.caption_count; keep.script_count := new.script_count; keep.video_count := new.video_count;
    keep.deadline := new.deadline; keep.revisions_allowed := new.revisions_allowed; keep.usage_rights := new.usage_rights;
    keep.usage_months := new.usage_months; keep.extra_requirements := new.extra_requirements; keep.package_id := new.package_id;
    if keep.package_id <> old.package_id then
      select * into p from public.ai_creator_packages where id = keep.package_id;
      if not found or p.creator_id <> old.creator_id or not p.active then raise exception 'Choose an available package from this creator.'; end if;
    end if;
    new := public.ai_orders_snapshot_price(keep);
  end if;
  new.updated_at := now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.compute_matches(_campaign uuid)
 RETURNS SETOF ai_match_results LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare c public.ai_campaigns; cr public.ai_creators; p public.ai_creator_packages; s public.platform_settings := public.settings();
  sc integer; reasons text[]; warns text[]; hits text[]; total integer; busy integer; covered boolean; txt text; left_budget integer;
begin
  select * into c from public.ai_campaigns where id = _campaign;
  if not found or (c.brand_id is distinct from auth.uid() and not public.is_staff(auth.uid())) then raise exception 'Campaign not found.'; end if;
  delete from public.ai_match_results where campaign_id = c.id;
  txt := lower(c.objective || ' ' || c.product_description || ' ' || c.instructions || ' ' || c.target_audience);
  left_budget := c.budget - public.campaign_committed(c.id, null);
  for cr in select * from public.ai_creators where active loop
    sc := 0; reasons := '{}'; warns := '{}'; p := null;
    if c.preferred_creator_id = cr.id then sc := sc + 10; reasons := reasons || 'You named this creator in the brief.'::text; end if;
    if c.niche is null then sc := sc + 15;
    elsif c.niche = any(cr.niches) then sc := sc + 30; reasons := reasons || format('Specialises in %s.', c.niche);
    else warns := warns || format('Not a %s specialist (focus: %s).', c.niche, array_to_string(cr.niches, ', ')); end if;
    hits := array(select a from unnest(cr.audiences) a where position(lower(a) in lower(c.target_audience)) > 0);
    if cardinality(hits) > 0 then sc := sc + 20; reasons := reasons || format('Speaks to your audience: %s.', array_to_string(hits, ', '));
    else sc := sc + 5; warns := warns || format('Audience overlap is general (usually reaches %s).', array_to_string(cr.audiences[1:3], ', ')); end if;
    hits := array(select st from unnest(cr.content_styles) st where position(lower(st) in txt) > 0);
    if cardinality(hits) > 0 then sc := sc + 15; reasons := reasons || format('Style matches your brief: %s.', array_to_string(hits, ', '));
    else sc := sc + 5; end if;
    if c.language = any(cr.languages) then reasons := reasons || format('Creates in %s.', c.language);
    else sc := sc - 10; warns := warns || format('Does not create in %s.', c.language); end if;
    covered := (c.image_count = 0 or 'image' = any(cr.formats)) and (c.script_count = 0 or 'script' = any(cr.formats)) and (c.video_count = 0 or 'video' = any(cr.formats));
    select * into p from public.ai_creator_packages where creator_id = cr.id and active
      and image_count >= c.image_count and caption_count >= c.caption_count and script_count >= c.script_count and video_count >= c.video_count
      order by (revisions_included >= c.revision_allowance and usage_months >= c.usage_months and current_date + turnaround_days <= c.deadline
        and price + case when s.fee_mode = 'separate' then round(price * s.commission_pct / 100.0)::int else 0 end <= left_budget) desc,
        (revisions_included >= c.revision_allowance and usage_months >= c.usage_months and current_date + turnaround_days <= c.deadline) desc, price
      limit 1;
    if found and covered then
      sc := sc + 20; reasons := reasons || format('"%s" package covers your formats (%s).', p.name, concat_ws(', ',
        case when p.image_count > 0 then p.image_count || case when p.image_count = 1 then ' image' else ' images' end end,
        case when p.caption_count > 0 then p.caption_count || case when p.caption_count = 1 then ' caption' else ' captions' end end,
        case when p.script_count > 0 then p.script_count || case when p.script_count = 1 then ' video script' else ' video scripts' end end,
        case when p.video_count > 0 then p.video_count || case when p.video_count = 1 then ' video' else ' videos' end end));
      if p.revisions_included < c.revision_allowance then warns := warns || format('Includes %s revisions (you asked for %s); extra revisions cost %s each.', p.revisions_included, c.revision_allowance, public.inr(p.extra_revision_price)); end if;
      if p.usage_months < c.usage_months then warns := warns || format('Licenses content for %s months (you asked for %s); extended rights can be added later.', p.usage_months, c.usage_months); end if;
    else
      select * into p from public.ai_creator_packages where creator_id = cr.id and active order by price desc limit 1;
      warns := warns || case when not covered then 'Does not offer every content format you asked for.' else 'No single package covers the quantity you asked for.' end;
    end if;
    if p.id is not null then
      total := p.price + case when s.fee_mode = 'separate' then round(p.price * s.commission_pct / 100.0)::int else 0 end;
      if total <= left_budget then sc := sc + 15; reasons := reasons || format('Fits your budget: %s incl. platform fee.', public.inr(total));
      else warns := warns || format('Over remaining budget: %s incl. fee vs %s left.', public.inr(total), public.inr(left_budget)); end if;
      if c.deadline < current_date + p.turnaround_days then warns := warns || format('Needs %s days; your deadline is sooner.', p.turnaround_days); sc := sc - 10; end if;
    end if;
    select count(*) into busy from public.v2_ai_orders where creator_id = cr.id and status in ('awaiting_payment','in_production','ready_for_review','revision_requested');
    if busy >= cr.max_active_orders then sc := sc - 30; warns := warns || 'Fully booked right now.'::text; end if;
    insert into public.ai_match_results (campaign_id, creator_id, package_id, score, reasons, warnings, computed_at)
    values (c.id, cr.id, p.id, greatest(0, least(100, sc)), reasons, warns, now());
  end loop;
  return query select * from public.ai_match_results where campaign_id = c.id order by score desc;
end $function$;

CREATE OR REPLACE FUNCTION public.send_offer(_order uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare o public.v2_ai_orders; c public.ai_campaigns; cr public.ai_creators; p public.ai_creator_packages;
  plan public.subscription_plans; sent integer; busy integer; committed integer;
  reasons text[] := '{}'; blob text; w text;
  restricted text[] := array['nsfw','nude','explicit','adult content','hate','weapon','gun','gambling','casino','betting','tobacco','cigarette','vape','election','political'];
begin
  o := public.my_order(_order);
  if o.status <> 'draft' then raise exception 'Only draft offers can be sent.'; end if;
  if not public.is_verified(o.brand_id) then raise exception 'Get your brand verified before sending offers.'; end if;
  plan := public.brand_plan(o.brand_id);
  if plan.order_limit is not null then
    select count(*) into sent from public.v2_ai_orders where brand_id = o.brand_id and sent_at > now() - interval '30 days';
    if sent >= plan.order_limit then
      raise exception 'Your % plan allows % offers per 30 days. Upgrade in Billing to send more.', plan.name, plan.order_limit;
    end if;
  end if;
  select * into c from public.ai_campaigns where id = o.campaign_id;
  select * into cr from public.ai_creators where id = o.creator_id;
  select * into p from public.ai_creator_packages where id = o.package_id;
  o := public.ai_orders_snapshot_price(o);

  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'awaiting_confirmation', sent_at = now(), package_price = o.package_price,
    commission_pct = o.commission_pct, fee_mode = o.fee_mode, platform_fee = o.platform_fee, brand_total = o.brand_total,
    extra_revision_price = o.extra_revision_price
  where id = o.id;
  perform public.order_event(o.id, 'sent', format('Offer sent to %s: %s package at %s (+ %s platform fee = %s).',
    cr.name, p.name, public.inr(o.package_price), public.inr(o.platform_fee), public.inr(o.brand_total)));

  if not cr.active then reasons := reasons || format('%s is not taking orders right now.', cr.name); end if;
  if not p.active then reasons := reasons || format('The %s package is no longer offered.', p.name); end if;
  if o.image_count + o.caption_count + o.script_count + o.video_count = 0 then reasons := reasons || 'Request at least one deliverable.'::text; end if;
  if o.image_count > p.image_count then reasons := reasons || format('The %s package includes up to %s images; the offer asks for %s.', p.name, p.image_count, o.image_count); end if;
  if o.caption_count > p.caption_count then reasons := reasons || format('The %s package includes up to %s captions; the offer asks for %s.', p.name, p.caption_count, o.caption_count); end if;
  if o.script_count > p.script_count then reasons := reasons || format('The %s package includes up to %s video scripts; the offer asks for %s.', p.name, p.script_count, o.script_count); end if;
  if o.video_count > p.video_count then reasons := reasons || format('The %s package includes up to %s videos; the offer asks for %s.', p.name, p.video_count, o.video_count); end if;
  if o.image_count > 0 and not ('image' = any(cr.formats)) then reasons := reasons || format('%s does not create images.', cr.name); end if;
  if o.script_count > 0 and not ('script' = any(cr.formats)) then reasons := reasons || format('%s does not write video scripts.', cr.name); end if;
  if o.video_count > 0 and not ('video' = any(cr.formats)) then reasons := reasons || format('%s does not make videos.', cr.name); end if;
  if o.deadline < current_date + p.turnaround_days then
    reasons := reasons || format('This package needs %s days; the earliest deadline is %s.', p.turnaround_days, to_char(current_date + p.turnaround_days, 'DD Mon YYYY'));
  end if;
  if o.revisions_allowed > p.revisions_included then reasons := reasons || format('The package includes %s revisions; the offer asks for %s.', p.revisions_included, o.revisions_allowed); end if;
  if o.usage_months > p.usage_months then reasons := reasons || format('The package licenses content for up to %s months; extended rights can be added after approval.', p.usage_months); end if;
  select count(*) into busy from public.v2_ai_orders where creator_id = cr.id and status in ('awaiting_payment','in_production','ready_for_review','revision_requested');
  if busy >= cr.max_active_orders then reasons := reasons || format('%s is fully booked right now. Try again later or pick another creator.', cr.name); end if;
  committed := public.campaign_committed(c.id, o.id);
  if committed + o.brand_total > c.budget then
    reasons := reasons || format('This offer (%s incl. fee) would take campaign spending to %s, over the %s budget.',
      public.inr(o.brand_total), public.inr(committed + o.brand_total), public.inr(c.budget));
  end if;
  blob := lower(c.product_description || ' ' || c.instructions || ' ' || o.extra_requirements);
  foreach w in array restricted loop
    if blob ~ ('\m' || w || '\M') then
      reasons := reasons || format('The brief mentions restricted content ("%s"), which Qolabrate AI creators do not produce.', w);
      exit;
    end if;
  end loop;

  if cardinality(reasons) > 0 then
    update public.v2_ai_orders set status = 'rejected', decided_at = now(), decision_reason = array_to_string(reasons, ' ') where id = o.id returning * into o;
    perform public.order_event(o.id, 'rejected', 'Not accepted: ' || o.decision_reason);
    perform public.order_notify(o, format('%s could not accept your offer. See why and adjust it.', cr.name));
  else
    update public.v2_ai_orders set status = 'accepted', decided_at = now(), decision_reason = null where id = o.id returning * into o;
    perform public.order_event(o.id, 'accepted', format('%s accepted the offer. Review the final price and confirm the order.', cr.name));
    perform public.order_notify(o, format('%s accepted your offer. Confirm the order to continue.', cr.name));
  end if;
  perform set_config('qola.internal', 'off', true);
  return jsonb_build_object('status', o.status, 'reasons', to_jsonb(reasons));
end $function$;

CREATE OR REPLACE FUNCTION public.begin_generation(_order uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare o public.v2_ai_orders; lock_window interval;
begin
  select * into o from public.v2_ai_orders where id = _order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status not in ('in_production','revision_requested') then raise exception 'This order is not ready for content generation.'; end if;
  if not exists (select 1 from public.payments where order_id = o.id and kind = 'order' and status = 'succeeded') then
    raise exception 'Payment must be recorded before content is generated.';
  end if;
  if exists (select 1 from public.order_charges where order_id = o.id and status = 'unpaid') then
    raise exception 'Pay the outstanding extra charge before the revision is generated.';
  end if;
  lock_window := public.generation_window(o.video_count);
  if o.generating_since is not null and o.generating_since > now() - lock_window then
    raise exception 'Content is already being generated for this order.';
  end if;
  delete from public.ai_order_assets where order_id = o.id and version > o.current_version;
  delete from public.ai_video_jobs where order_id = o.id and version > o.current_version;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set generating_since = now() where id = o.id;
  insert into public.ai_order_events (order_id, kind, body) values (o.id, 'generating', format('Generating version %s.', o.current_version + 1));
  perform set_config('qola.internal', 'off', true);
  return o.current_version + 1;
end $function$;

CREATE OR REPLACE FUNCTION public.fail_generation(_order uuid, _message text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  delete from public.ai_order_assets a using public.v2_ai_orders o
    where a.order_id = _order and o.id = _order and a.version > o.current_version;
  delete from public.ai_video_jobs j using public.v2_ai_orders o
    where j.order_id = _order and o.id = _order and j.version > o.current_version;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set generating_since = null where id = _order;
  insert into public.ai_order_events (order_id, kind, body) values (_order, 'generation_failed', 'Generation did not finish: ' || left(coalesce(_message, 'unknown error'), 500) || ' No new content was created.');
  perform set_config('qola.internal', 'off', true);
end $function$;

CREATE OR REPLACE FUNCTION public.finish_generation(_order uuid, _version integer, _images integer, _texts integer, _videos integer DEFAULT 0)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare o public.v2_ai_orders; s public.platform_settings := public.settings();
begin
  select * into o from public.v2_ai_orders where id = _order for update;
  if o.status not in ('in_production','revision_requested') or _version <> o.current_version + 1 then raise exception 'Unexpected generation result.'; end if;
  update public.ai_order_assets set status = 'superseded' where order_id = o.id and version < _version and status = 'in_review';
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'ready_for_review', current_version = _version, ready_at = now(), generating_since = null,
    generation_cost_estimate = generation_cost_estimate + _images * s.image_cost_estimate + _texts * s.text_cost_estimate + _videos * s.video_cost_estimate
  where id = o.id returning * into o;
  insert into public.ai_order_events (order_id, kind, body) values (o.id, 'content_ready', format('Version %s is ready for review: %s, AI-generated.', _version,
    concat_ws(', ', case when _images > 0 then _images || case when _images = 1 then ' image' else ' images' end end,
                    case when _videos > 0 then _videos || case when _videos = 1 then ' video' else ' videos' end end,
                    case when _texts > 0 then _texts || case when _texts = 1 then ' text piece' else ' text pieces' end end)));
  delete from public.ai_video_jobs where order_id = o.id and version = _version;
  perform public.order_notify(o, format('Version %s of your content is ready for review.', _version));
  perform set_config('qola.internal', 'off', true);
end $function$;

revoke execute on function public.finish_generation(uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.finish_generation(uuid, integer, integer, integer, integer) to service_role;
revoke execute on function public.begin_generation(uuid) from public, anon, authenticated;
grant execute on function public.begin_generation(uuid) to service_role;
revoke execute on function public.fail_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_generation(uuid, text) to service_role;

update public.ai_creators set formats = formats || array['video'] where 'script' = any(formats) and not ('video' = any(formats));

insert into public.ai_creator_packages (id, creator_id, name, description, image_count, caption_count, script_count, video_count, price, revisions_included, extra_revision_price, turnaround_days, usage_rights, usage_months, extended_rights_price, sort)
select ('a2000000-0000-4000-8000-0000000001' || lpad(g.n::text, 2, '0'))::uuid, c.id, 'Reel',
  'One 8-second vertical video with sound, plus a cover image, caption and script.',
  1, 1, 1, 1, (round(9000 * g.mult / 100.0) * 100)::int, 1, (round(1500 * g.mult / 50.0) * 50)::int, 5, 'Organic social media', 6, (round(4000 * g.mult / 100.0) * 100)::int, 4
from (values
  (1, 'a1000000-0000-4000-8000-000000000001'::uuid, 1.2), (2, 'a1000000-0000-4000-8000-000000000002'::uuid, 1.0),
  (3, 'a1000000-0000-4000-8000-000000000003'::uuid, 0.9), (4, 'a1000000-0000-4000-8000-000000000004'::uuid, 0.8),
  (5, 'a1000000-0000-4000-8000-000000000005'::uuid, 1.1), (6, 'a1000000-0000-4000-8000-000000000006'::uuid, 1.15),
  (7, 'a1000000-0000-4000-8000-000000000007'::uuid, 0.85), (8, 'a1000000-0000-4000-8000-000000000008'::uuid, 1.3)
) as g(n, cid, mult)
join public.ai_creators c on c.id = g.cid and 'video' = any(c.formats)
on conflict (id) do nothing;