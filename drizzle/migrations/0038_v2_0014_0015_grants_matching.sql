revoke insert, update, delete, truncate on public.platform_settings, public.subscription_plans, public.v2_brand_subscriptions,
  public.ai_creators, public.ai_creator_packages, public.ai_match_results, public.ai_order_events,
  public.ai_order_assets, public.order_charges, public.payments from anon, authenticated;
revoke all on public.platform_settings, public.v2_brand_subscriptions, public.ai_match_results, public.ai_order_events,
  public.ai_order_assets, public.order_charges, public.payments, public.ai_campaigns, public.v2_ai_orders from anon;
revoke truncate on public.ai_campaigns, public.v2_ai_orders from authenticated;
revoke execute on function public.send_offer(uuid), public.revise_offer(uuid), public.confirm_order(uuid), public.simulate_payment(uuid),
  public.cancel_order(uuid, text), public.request_revision(uuid, text), public.approve_content(uuid), public.complete_order(uuid),
  public.add_extended_rights(uuid), public.pay_charge(uuid), public.change_plan(text), public.compute_matches(uuid),
  public.admin_update_settings(numeric, text, numeric, integer, integer), public.admin_set_ai_creator(uuid, boolean, text),
  public.admin_set_package(uuid, integer, boolean), public.admin_refund_order(uuid, text), public.admin_revenue_summary() from anon;

create or replace function public.compute_matches(_campaign uuid) returns setof public.ai_match_results
language plpgsql security definer set search_path = public as $$
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
    covered := (c.image_count = 0 or 'image' = any(cr.formats)) and (c.script_count = 0 or 'script' = any(cr.formats));
    select * into p from public.ai_creator_packages where creator_id = cr.id and active
      and image_count >= c.image_count and caption_count >= c.caption_count and script_count >= c.script_count
      order by (revisions_included >= c.revision_allowance and usage_months >= c.usage_months and current_date + turnaround_days <= c.deadline
        and price + case when s.fee_mode = 'separate' then round(price * s.commission_pct / 100.0)::int else 0 end <= left_budget) desc,
        (revisions_included >= c.revision_allowance and usage_months >= c.usage_months and current_date + turnaround_days <= c.deadline) desc, price
      limit 1;
    if found and covered then
      sc := sc + 20; reasons := reasons || format('"%s" package covers your formats (%s).', p.name, concat_ws(', ',
        case when p.image_count > 0 then p.image_count || case when p.image_count = 1 then ' image' else ' images' end end,
        case when p.caption_count > 0 then p.caption_count || case when p.caption_count = 1 then ' caption' else ' captions' end end,
        case when p.script_count > 0 then p.script_count || case when p.script_count = 1 then ' video script' else ' video scripts' end end));
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
end $$;