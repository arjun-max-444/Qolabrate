create or replace function public.confirm_order(_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders; c public.ai_campaigns; committed integer;
begin
  o := public.my_order(_order);
  if o.status <> 'accepted' then raise exception 'Only accepted offers can be confirmed.'; end if;
  select * into c from public.ai_campaigns where id = o.campaign_id;
  committed := public.campaign_committed(c.id, o.id);
  if committed + o.brand_total > c.budget then
    raise exception 'Confirming would take campaign spending to %, over the % budget.', public.inr(committed + o.brand_total), public.inr(c.budget);
  end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'awaiting_payment', confirmed_at = now() where id = o.id;
  perform public.order_event(o.id, 'confirmed', format('Order confirmed: package %s + platform fee %s (%s%%) = %s due.',
    public.inr(o.package_price), public.inr(o.platform_fee), trim_scale(o.commission_pct), public.inr(o.brand_total)));
  perform set_config('qola.internal', 'off', true);
end $$;

create or replace function public.finish_generation(_order uuid, _version integer, _images integer, _texts integer) returns void
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders; s public.platform_settings := public.settings();
begin
  select * into o from public.v2_ai_orders where id = _order for update;
  if o.status not in ('in_production','revision_requested') or _version <> o.current_version + 1 then raise exception 'Unexpected generation result.'; end if;
  update public.ai_order_assets set status = 'superseded' where order_id = o.id and version < _version and status = 'in_review';
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'ready_for_review', current_version = _version, ready_at = now(), generating_since = null,
    generation_cost_estimate = generation_cost_estimate + _images * s.image_cost_estimate + _texts * s.text_cost_estimate
  where id = o.id returning * into o;
  insert into public.ai_order_events (order_id, kind, body) values (o.id, 'content_ready', format('Version %s is ready for review: %s, AI-generated.', _version,
    concat_ws(', ', case when _images > 0 then _images || case when _images = 1 then ' image' else ' images' end end,
                    case when _texts > 0 then _texts || case when _texts = 1 then ' text piece' else ' text pieces' end end)));
  perform public.order_notify(o, format('Version %s of your content is ready for review.', _version));
  perform set_config('qola.internal', 'off', true);
end $$;
revoke execute on function public.finish_generation(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.finish_generation(uuid, integer, integer, integer) to service_role;