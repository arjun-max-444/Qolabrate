create or replace function public.inr(_n bigint) returns text
language sql immutable set search_path = public as $$
  select '₹' || to_char(coalesce(_n, 0), 'FM99,99,99,99,999')
$$;

create table public.platform_settings (
  id boolean primary key default true check (id),
  commission_pct numeric(5,2) not null default 10 check (commission_pct >= 0 and commission_pct <= 50),
  fee_mode text not null default 'separate' check (fee_mode in ('separate','included')),
  payment_fee_pct numeric(5,2) not null default 0 check (payment_fee_pct >= 0 and payment_fee_pct <= 10),
  image_cost_estimate integer not null default 8 check (image_cost_estimate >= 0),
  text_cost_estimate integer not null default 1 check (text_cost_estimate >= 0),
  updated_at timestamptz not null default now()
);
grant select on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;
create policy "Members read platform settings" on public.platform_settings for select to authenticated using (true);
insert into public.platform_settings (id) values (true) on conflict do nothing;

create or replace function public.settings() returns public.platform_settings
language sql stable security definer set search_path = public as $$
  select * from public.platform_settings where id
$$;

create table public.subscription_plans (
  id text primary key,
  name text not null,
  price_monthly integer not null check (price_monthly >= 0),
  campaign_limit integer,
  order_limit integer,
  features text[] not null default '{}',
  sort integer not null default 0
);
grant select on public.subscription_plans to authenticated, anon;
grant all on public.subscription_plans to service_role;
alter table public.subscription_plans enable row level security;
create policy "Anyone reads plans" on public.subscription_plans for select to authenticated, anon using (true);
insert into public.subscription_plans (id, name, price_monthly, campaign_limit, order_limit, features, sort) values
  ('free', 'Starter', 0, 2, 3, array['2 campaigns per 30 days','3 offers per 30 days','AI matching','Basic campaign analytics'], 0),
  ('growth', 'Growth', 2999, 10, 20, array['10 campaigns per 30 days','20 offers per 30 days','AI matching with full reasons','Campaign analytics + recommendations'], 1),
  ('pro', 'Pro', 9999, null, null, array['Unlimited campaigns','Unlimited offers','Priority AI matching','Full analytics and exports'], 2)
on conflict (id) do nothing;

create table public.v2_brand_subscriptions (
  brand_id uuid primary key references public.v2_profiles(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'active' check (status in ('active','cancelled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  is_simulated boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select on public.v2_brand_subscriptions to authenticated;
grant all on public.v2_brand_subscriptions to service_role;
alter table public.v2_brand_subscriptions enable row level security;
create policy "Brands read own subscription" on public.v2_brand_subscriptions for select to authenticated
  using (brand_id = auth.uid() or public.is_staff(auth.uid()));

create or replace function public.brand_plan(_uid uuid) returns public.subscription_plans
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p from public.v2_brand_subscriptions s join public.subscription_plans p on p.id = s.plan_id
      where s.brand_id = _uid and s.status = 'active' and (s.current_period_end is null or s.current_period_end > now())),
    (select p from public.subscription_plans p where p.id = 'free'))
$$;

create table public.ai_creators (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  tagline text not null,
  bio text not null,
  personality text not null,
  style_prompt text not null,
  voice_prompt text not null,
  niches text[] not null default '{}',
  audiences text[] not null default '{}',
  content_styles text[] not null default '{}',
  formats text[] not null default '{image,caption}',
  languages text[] not null default '{English}',
  avatar_url text,
  portfolio jsonb not null default '[]'::jsonb,
  usage_terms text not null,
  max_active_orders integer not null default 10 check (max_active_orders > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.ai_creators to authenticated, anon;
grant all on public.ai_creators to service_role;
alter table public.ai_creators enable row level security;
create policy "Anyone reads active AI creators" on public.ai_creators for select to authenticated, anon
  using (active or public.is_staff(auth.uid()));

create table public.ai_creator_packages (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.ai_creators(id) on delete cascade,
  name text not null,
  description text not null,
  image_count integer not null default 1 check (image_count between 0 and 6),
  caption_count integer not null default 1 check (caption_count between 0 and 6),
  script_count integer not null default 0 check (script_count between 0 and 2),
  price integer not null check (price >= 500),
  revisions_included integer not null default 2 check (revisions_included between 0 and 10),
  extra_revision_price integer check (extra_revision_price is null or extra_revision_price > 0),
  turnaround_days integer not null default 3 check (turnaround_days between 1 and 30),
  usage_rights text not null,
  usage_months integer not null default 6 check (usage_months between 1 and 60),
  extended_rights_price integer check (extended_rights_price is null or extended_rights_price > 0),
  active boolean not null default true,
  sort integer not null default 0
);
create index ai_creator_packages_creator_idx on public.ai_creator_packages (creator_id);
grant select on public.ai_creator_packages to authenticated, anon;
grant all on public.ai_creator_packages to service_role;
alter table public.ai_creator_packages enable row level security;
create policy "Anyone reads active packages" on public.ai_creator_packages for select to authenticated, anon
  using ((active and exists (select 1 from public.ai_creators c where c.id = creator_id and c.active)) or public.is_staff(auth.uid()));

create table public.ai_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.v2_profiles(id) on delete cascade,
  name text not null,
  product_description text not null,
  objective text not null,
  target_audience text not null,
  location text,
  language text not null default 'English',
  niche text,
  preferred_creator_id uuid references public.ai_creators(id) on delete set null,
  image_count integer not null default 1,
  caption_count integer not null default 1,
  script_count integer not null default 0,
  budget integer not null,
  deadline date not null,
  instructions text not null default '',
  reference_urls text[] not null default '{}',
  revision_allowance integer not null default 2,
  usage_rights text not null default 'Organic social media',
  usage_months integer not null default 6,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_campaigns_brand_idx on public.ai_campaigns (brand_id, created_at desc);
grant select, insert, update, delete on public.ai_campaigns to authenticated;
grant all on public.ai_campaigns to service_role;
alter table public.ai_campaigns enable row level security;
create policy "Brands read own campaigns" on public.ai_campaigns for select to authenticated using (brand_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Brands create own campaigns" on public.ai_campaigns for insert to authenticated with check (brand_id = auth.uid());
create policy "Brands update own campaigns" on public.ai_campaigns for update to authenticated using (brand_id = auth.uid()) with check (brand_id = auth.uid());
create policy "Brands delete own campaigns" on public.ai_campaigns for delete to authenticated using (brand_id = auth.uid());

create or replace function public.ai_campaigns_guard() returns trigger
language plpgsql security definer set search_path = public as $$
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
  if new.image_count not between 0 and 6 or new.caption_count not between 0 and 6 or new.script_count not between 0 and 2 then
    raise exception 'Up to 6 images, 6 captions and 2 scripts per campaign.';
  end if;
  if new.image_count + new.caption_count + new.script_count = 0 then raise exception 'Ask for at least one piece of content.'; end if;
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
end $$;
create trigger ai_campaigns_guard before insert or update on public.ai_campaigns for each row execute function public.ai_campaigns_guard();

create table public.ai_match_results (
  campaign_id uuid not null references public.ai_campaigns(id) on delete cascade,
  creator_id uuid not null references public.ai_creators(id) on delete cascade,
  package_id uuid references public.ai_creator_packages(id) on delete set null,
  score integer not null,
  reasons text[] not null default '{}',
  warnings text[] not null default '{}',
  computed_at timestamptz not null default now(),
  primary key (campaign_id, creator_id)
);
grant select on public.ai_match_results to authenticated;
grant all on public.ai_match_results to service_role;
alter table public.ai_match_results enable row level security;
create policy "Brands read own matches" on public.ai_match_results for select to authenticated
  using (exists (select 1 from public.ai_campaigns c where c.id = campaign_id and (c.brand_id = auth.uid() or public.is_staff(auth.uid()))));

create table public.v2_ai_orders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.v2_profiles(id) on delete cascade,
  campaign_id uuid not null references public.ai_campaigns(id) on delete restrict,
  creator_id uuid not null references public.ai_creators(id),
  package_id uuid not null references public.ai_creator_packages(id),
  status text not null default 'draft' check (status in (
    'draft','awaiting_confirmation','accepted','rejected','awaiting_payment','in_production',
    'ready_for_review','revision_requested','approved','completed','cancelled','refunded')),
  image_count integer not null default 0 check (image_count between 0 and 6),
  caption_count integer not null default 0 check (caption_count between 0 and 6),
  script_count integer not null default 0 check (script_count between 0 and 2),
  deadline date not null,
  revisions_allowed integer not null default 0 check (revisions_allowed between 0 and 10),
  usage_rights text not null default '',
  usage_months integer not null default 6 check (usage_months between 1 and 120),
  extra_requirements text not null default '' check (length(extra_requirements) <= 2000),
  package_price integer not null default 0,
  commission_pct numeric(5,2) not null default 0,
  fee_mode text not null default 'separate',
  platform_fee integer not null default 0,
  brand_total integer not null default 0,
  extra_revision_price integer,
  decision_reason text,
  revisions_used integer not null default 0,
  current_version integer not null default 0,
  last_feedback text,
  generating_since timestamptz,
  generation_cost_estimate integer not null default 0,
  payment_fee integer not null default 0,
  sent_at timestamptz, decided_at timestamptz, confirmed_at timestamptz, paid_at timestamptz,
  production_started_at timestamptz, ready_at timestamptz, approved_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index v2_ai_orders_brand_idx on public.v2_ai_orders (brand_id, created_at desc);
create index ai_orders_campaign_idx on public.v2_ai_orders (campaign_id);
create index ai_orders_creator_idx on public.v2_ai_orders (creator_id, status);
create unique index ai_orders_one_open_per_creator on public.v2_ai_orders (campaign_id, creator_id)
  where status not in ('rejected','cancelled','refunded','completed');
grant select, insert, update, delete on public.v2_ai_orders to authenticated;
grant all on public.v2_ai_orders to service_role;
alter table public.v2_ai_orders enable row level security;
create policy "Brands read own orders" on public.v2_ai_orders for select to authenticated using (brand_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Brands create own orders" on public.v2_ai_orders for insert to authenticated with check (brand_id = auth.uid());
create policy "Brands edit own draft orders" on public.v2_ai_orders for update to authenticated using (brand_id = auth.uid()) with check (brand_id = auth.uid());
create policy "Brands delete own draft orders" on public.v2_ai_orders for delete to authenticated using (brand_id = auth.uid() and status = 'draft');

create or replace function public.is_order_brand(_order uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.v2_ai_orders where id = _order and brand_id = _uid)
$$;

create or replace function public.ai_orders_snapshot_price(o public.v2_ai_orders) returns public.v2_ai_orders
language plpgsql stable security definer set search_path = public as $$
declare p public.ai_creator_packages; s public.platform_settings := public.settings();
begin
  select * into p from public.ai_creator_packages where id = o.package_id;
  o.package_price := p.price;
  o.commission_pct := s.commission_pct;
  o.fee_mode := s.fee_mode;
  o.platform_fee := round(p.price * s.commission_pct / 100.0)::int;
  o.brand_total := case when s.fee_mode = 'separate' then p.price + o.platform_fee else p.price end;
  o.extra_revision_price := p.extra_revision_price;
  return o;
end $$;

create or replace function public.ai_orders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
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
    keep.image_count := new.image_count; keep.caption_count := new.caption_count; keep.script_count := new.script_count;
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
end $$;
create trigger ai_orders_guard before insert or update on public.v2_ai_orders for each row execute function public.ai_orders_guard();

create table public.ai_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.v2_ai_orders(id) on delete cascade,
  actor_id uuid references public.v2_profiles(id) on delete set null,
  kind text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index ai_order_events_order_idx on public.ai_order_events (order_id, created_at);
grant select on public.ai_order_events to authenticated;
grant all on public.ai_order_events to service_role;
alter table public.ai_order_events enable row level security;
create policy "Brands read own order history" on public.ai_order_events for select to authenticated
  using (public.is_order_brand(order_id, auth.uid()) or public.is_staff(auth.uid()));

create table public.ai_order_assets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.v2_ai_orders(id) on delete cascade,
  version integer not null,
  kind text not null check (kind in ('image','caption','script')),
  position integer not null default 1,
  content text,
  storage_path text,
  prompt text,
  status text not null default 'in_review' check (status in ('in_review','approved','superseded')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, version, kind, position)
);
grant select on public.ai_order_assets to authenticated;
grant all on public.ai_order_assets to service_role;
alter table public.ai_order_assets enable row level security;
create policy "Brands read own order content" on public.ai_order_assets for select to authenticated
  using (public.is_order_brand(order_id, auth.uid()) or public.is_staff(auth.uid()));

create table public.order_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.v2_ai_orders(id) on delete cascade,
  brand_id uuid not null references public.v2_profiles(id) on delete cascade,
  kind text not null check (kind in ('extra_revision','extended_rights')),
  description text not null,
  amount integer not null check (amount > 0),
  months integer,
  status text not null default 'unpaid' check (status in ('unpaid','paid','void')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index order_charges_order_idx on public.order_charges (order_id);
grant select on public.order_charges to authenticated;
grant all on public.order_charges to service_role;
alter table public.order_charges enable row level security;
create policy "Brands read own charges" on public.order_charges for select to authenticated
  using (brand_id = auth.uid() or public.is_staff(auth.uid()));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.v2_profiles(id) on delete cascade,
  kind text not null check (kind in ('order','charge','subscription')),
  order_id uuid references public.v2_ai_orders(id) on delete set null,
  charge_id uuid references public.order_charges(id) on delete set null,
  plan_id text references public.subscription_plans(id),
  amount integer not null check (amount >= 0),
  platform_fee integer not null default 0,
  processing_fee integer not null default 0,
  provider text not null default 'simulated',
  is_simulated boolean not null default true,
  status text not null default 'succeeded' check (status in ('succeeded','refunded')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);
create unique index payments_one_per_order on public.payments (order_id) where kind = 'order';
create unique index payments_one_per_charge on public.payments (charge_id) where kind = 'charge';
create index payments_brand_idx on public.payments (brand_id, created_at desc);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "Brands read own payments" on public.payments for select to authenticated
  using (brand_id = auth.uid() or public.is_staff(auth.uid()));

create or replace function public.order_event(_order uuid, _kind text, _body text) returns void
language sql security definer set search_path = public as $$
  insert into public.ai_order_events (order_id, actor_id, kind, body) values (_order, auth.uid(), _kind, left(_body, 2000));
$$;
revoke execute on function public.order_event(uuid, text, text) from public, anon, authenticated;

create or replace function public.order_notify(o public.v2_ai_orders, _body text) returns void
language sql security definer set search_path = public as $$
  select public.v2_notify(o.brand_id, null, 'order', _body, '/orders/' || o.id, 'order:' || o.id || ':' || o.status);
$$;
revoke execute on function public.order_notify(public.v2_ai_orders, text) from public, anon, authenticated;

create or replace function public.my_order(_order uuid) returns public.v2_ai_orders
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders;
begin
  select * into o from public.v2_ai_orders where id = _order for update;
  if not found or o.brand_id is distinct from auth.uid() then raise exception 'Order not found.'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'Your account is suspended.'; end if;
  return o;
end $$;
revoke execute on function public.my_order(uuid) from public, anon, authenticated;

create or replace function public.campaign_committed(_campaign uuid, _except uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(brand_total), 0)::int from public.v2_ai_orders
  where campaign_id = _campaign and id <> coalesce(_except, '00000000-0000-0000-0000-000000000000'::uuid)
    and status not in ('draft','rejected','cancelled','refunded')
$$;

create or replace function public.send_offer(_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if o.image_count + o.caption_count + o.script_count = 0 then reasons := reasons || 'Request at least one deliverable.'::text; end if;
  if o.image_count > p.image_count then reasons := reasons || format('The %s package includes up to %s images; the offer asks for %s.', p.name, p.image_count, o.image_count); end if;
  if o.caption_count > p.caption_count then reasons := reasons || format('The %s package includes up to %s captions; the offer asks for %s.', p.name, p.caption_count, o.caption_count); end if;
  if o.script_count > p.script_count then reasons := reasons || format('The %s package includes up to %s video scripts; the offer asks for %s.', p.name, p.script_count, o.script_count); end if;
  if o.image_count > 0 and not ('image' = any(cr.formats)) then reasons := reasons || format('%s does not create images.', cr.name); end if;
  if o.script_count > 0 and not ('script' = any(cr.formats)) then reasons := reasons || format('%s does not write video scripts.', cr.name); end if;
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
end $$;

create or replace function public.revise_offer(_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders;
begin
  o := public.my_order(_order);
  if o.status <> 'rejected' then raise exception 'Only declined offers can be edited and re-sent.'; end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'draft', decided_at = null, sent_at = null where id = o.id;
  perform public.order_event(o.id, 'draft', 'Offer reopened for changes.');
  perform set_config('qola.internal', 'off', true);
end $$;

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
    public.inr(o.package_price), public.inr(o.platform_fee), o.commission_pct, public.inr(o.brand_total)));
  perform set_config('qola.internal', 'off', true);
end $$;

create or replace function public.simulate_payment(_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders; s public.platform_settings := public.settings(); fee integer;
begin
  o := public.my_order(_order);
  if o.status <> 'awaiting_payment' then raise exception 'This order is not waiting for payment.'; end if;
  if exists (select 1 from public.payments where order_id = o.id and kind = 'order') then raise exception 'A payment is already recorded for this order.'; end if;
  fee := round(o.brand_total * s.payment_fee_pct / 100.0)::int;
  insert into public.payments (brand_id, kind, order_id, amount, platform_fee, processing_fee, provider, is_simulated, status)
  values (o.brand_id, 'order', o.id, o.brand_total, o.platform_fee, fee, 'simulated', true, 'succeeded');
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'in_production', paid_at = now(), production_started_at = now(), payment_fee = fee where id = o.id returning * into o;
  perform public.order_event(o.id, 'payment', format('Simulated payment of %s recorded — no real money moved. Order is in production.', public.inr(o.brand_total)));
  perform public.order_notify(o, 'Simulated payment recorded. Your order is in production.');
  perform set_config('qola.internal', 'off', true);
end $$;

create or replace function public.cancel_order(_order uuid, _reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders;
begin
  o := public.my_order(_order);
  if o.status not in ('draft','awaiting_confirmation','accepted','rejected','awaiting_payment') then
    raise exception 'Paid orders can''t be cancelled here. Contact Qolabrate for a refund review.';
  end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'cancelled', cancelled_at = now() where id = o.id;
  perform public.order_event(o.id, 'cancelled', 'Cancelled by brand' || coalesce(': ' || nullif(btrim(left(_reason, 500)), ''), '.'));
  perform set_config('qola.internal', 'off', true);
end $$;

create or replace function public.begin_generation(_order uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders;
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
  if o.generating_since is not null and o.generating_since > now() - interval '15 minutes' then
    raise exception 'Content is already being generated for this order.';
  end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set generating_since = now() where id = o.id;
  insert into public.ai_order_events (order_id, kind, body) values (o.id, 'generating', format('Generating version %s.', o.current_version + 1));
  perform set_config('qola.internal', 'off', true);
  return o.current_version + 1;
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
  insert into public.ai_order_events (order_id, kind, body) values (o.id, 'content_ready', format('Version %s is ready for review (%s images, %s text pieces, AI-generated).', _version, _images, _texts));
  perform public.order_notify(o, format('Version %s of your content is ready for review.', _version));
  perform set_config('qola.internal', 'off', true);
end $$;

create or replace function public.fail_generation(_order uuid, _message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.ai_order_assets a using public.v2_ai_orders o
    where a.order_id = _order and o.id = _order and a.version > o.current_version;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set generating_since = null where id = _order;
  insert into public.ai_order_events (order_id, kind, body) values (_order, 'generation_failed', 'Generation did not finish: ' || left(coalesce(_message, 'unknown error'), 500) || ' No new content was created.');
  perform set_config('qola.internal', 'off', true);
end $$;

revoke execute on function public.begin_generation(uuid) from public, anon, authenticated;
revoke execute on function public.finish_generation(uuid, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.fail_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.begin_generation(uuid) to service_role;
grant execute on function public.finish_generation(uuid, integer, integer, integer) to service_role;
grant execute on function public.fail_generation(uuid, text) to service_role;

create or replace function public.request_revision(_order uuid, _feedback text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders; fb text := btrim(coalesce(_feedback, '')); charge uuid;
begin
  o := public.my_order(_order);
  if o.status <> 'ready_for_review' then raise exception 'Revisions can be requested only while content is in review.'; end if;
  if length(fb) < 5 or length(fb) > 2000 then raise exception 'Describe the changes you want (5–2,000 characters).'; end if;
  if o.revisions_used >= o.revisions_allowed then
    if o.extra_revision_price is null then raise exception 'No revisions left on this order.'; end if;
    insert into public.order_charges (order_id, brand_id, kind, description, amount)
    values (o.id, o.brand_id, 'extra_revision', format('Extra revision %s (beyond the %s included)', o.revisions_used + 1, o.revisions_allowed), o.extra_revision_price)
    returning id into charge;
  end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'revision_requested', revisions_used = revisions_used + 1, last_feedback = fb where id = o.id;
  perform public.order_event(o.id, 'revision_requested', format('Revision %s requested: %s', o.revisions_used + 1, fb));
  perform set_config('qola.internal', 'off', true);
  return jsonb_build_object('charge_id', charge);
end $$;

create or replace function public.approve_content(_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders;
begin
  o := public.my_order(_order);
  if o.status <> 'ready_for_review' then raise exception 'Only content in review can be approved.'; end if;
  update public.ai_order_assets set status = 'approved' where order_id = o.id and version = o.current_version;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'approved', approved_at = now() where id = o.id;
  perform public.order_event(o.id, 'approved', format('Version %s approved by the brand. Files are ready to download.', o.current_version));
  perform set_config('qola.internal', 'off', true);
end $$;

create or replace function public.complete_order(_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders;
begin
  o := public.my_order(_order);
  if o.status <> 'approved' then raise exception 'An order can be completed only after its content is approved.'; end if;
  if not exists (select 1 from public.payments where order_id = o.id and kind = 'order' and status = 'succeeded') then
    raise exception 'No payment is recorded for this order.';
  end if;
  if exists (select 1 from public.order_charges where order_id = o.id and status = 'unpaid') then
    raise exception 'Pay the outstanding charge before completing the order.';
  end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'completed', completed_at = now() where id = o.id;
  perform public.order_event(o.id, 'completed', format('Order completed. Platform commission %s recorded.', public.inr(o.platform_fee)));
  perform set_config('qola.internal', 'off', true);
end $$;

create or replace function public.add_extended_rights(_order uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders; p public.ai_creator_packages; charge uuid;
begin
  o := public.my_order(_order);
  if o.status not in ('approved','completed') then raise exception 'Extended rights can be added after the content is approved.'; end if;
  select * into p from public.ai_creator_packages where id = o.package_id;
  if p.extended_rights_price is null then raise exception 'This package has no extended rights option.'; end if;
  if exists (select 1 from public.order_charges where order_id = o.id and status = 'unpaid') then raise exception 'Pay or clear the outstanding charge first.'; end if;
  insert into public.order_charges (order_id, brand_id, kind, description, amount, months)
  values (o.id, o.brand_id, 'extended_rights', '12 more months of usage rights', p.extended_rights_price, 12) returning id into charge;
  perform public.order_event(o.id, 'charge', format('Extended usage rights added: %s for 12 more months (unpaid).', public.inr(p.extended_rights_price)));
  return charge;
end $$;

create or replace function public.pay_charge(_charge uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ch public.order_charges; s public.platform_settings := public.settings();
begin
  select * into ch from public.order_charges where id = _charge for update;
  if not found or ch.brand_id is distinct from auth.uid() then raise exception 'Charge not found.'; end if;
  if ch.status <> 'unpaid' then raise exception 'This charge is already settled.'; end if;
  insert into public.payments (brand_id, kind, order_id, charge_id, amount, platform_fee, processing_fee, provider, is_simulated, status)
  values (ch.brand_id, 'charge', ch.order_id, ch.id, ch.amount, ch.amount, round(ch.amount * s.payment_fee_pct / 100.0)::int, 'simulated', true, 'succeeded');
  update public.order_charges set status = 'paid', paid_at = now() where id = ch.id;
  perform set_config('qola.internal', 'on', true);
  if ch.kind = 'extended_rights' then
    update public.v2_ai_orders set usage_months = usage_months + coalesce(ch.months, 12) where id = ch.order_id;
  end if;
  perform public.order_event(ch.order_id, 'payment', format('Simulated payment of %s for "%s" recorded — no real money moved.', public.inr(ch.amount), ch.description));
  perform set_config('qola.internal', 'off', true);
end $$;

create or replace function public.change_plan(_plan text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.subscription_plans; cur public.subscription_plans; s public.platform_settings := public.settings();
begin
  if me is null or not exists (select 1 from public.v2_profiles where id = me and account_type = 'brand') then raise exception 'Only brand accounts have plans.'; end if;
  select * into p from public.subscription_plans where id = _plan;
  if not found then raise exception 'Unknown plan.'; end if;
  cur := public.brand_plan(me);
  if cur.id = p.id then raise exception 'You are already on the % plan.', p.name; end if;
  if p.price_monthly > 0 then
    insert into public.payments (brand_id, kind, plan_id, amount, platform_fee, processing_fee, provider, is_simulated, status)
    values (me, 'subscription', p.id, p.price_monthly, p.price_monthly, round(p.price_monthly * s.payment_fee_pct / 100.0)::int, 'simulated', true, 'succeeded');
  end if;
  insert into public.v2_brand_subscriptions (brand_id, plan_id, status, current_period_start, current_period_end, is_simulated, updated_at)
  values (me, p.id, 'active', now(), case when p.price_monthly > 0 then now() + interval '30 days' else null end, true, now())
  on conflict (brand_id) do update set plan_id = excluded.plan_id, status = 'active', current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end, updated_at = now();
end $$;

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
      order by price limit 1;
    if found and covered then
      sc := sc + 20; reasons := reasons || format('"%s" package covers your formats (%s images, %s captions%s).', p.name, p.image_count, p.caption_count,
        case when p.script_count > 0 then ', ' || p.script_count || ' script' else '' end);
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

create or replace function public.admin_update_settings(_commission numeric, _fee_mode text, _payment_fee_pct numeric, _image_cost integer, _text_cost integer) returns void
language plpgsql security definer set search_path = public as $$
declare before public.platform_settings := public.settings();
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Admins only.'; end if;
  update public.platform_settings set commission_pct = _commission, fee_mode = _fee_mode, payment_fee_pct = _payment_fee_pct,
    image_cost_estimate = _image_cost, text_cost_estimate = _text_cost, updated_at = now() where id;
  perform public.audit('update_settings', 'settings', null, null, jsonb_build_object('before', to_jsonb(before), 'after', to_jsonb(public.settings())));
end $$;

create or replace function public.admin_set_ai_creator(_creator uuid, _active boolean, _reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Admins only.'; end if;
  update public.ai_creators set active = _active, updated_at = now() where id = _creator;
  if not found then raise exception 'AI creator not found.'; end if;
  perform public.audit(case when _active then 'ai_creator_on' else 'ai_creator_off' end, 'ai_creator', _creator, _reason, '{}'::jsonb);
end $$;

create or replace function public.admin_set_package(_package uuid, _price integer, _active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare before public.ai_creator_packages;
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Admins only.'; end if;
  select * into before from public.ai_creator_packages where id = _package;
  if not found then raise exception 'Package not found.'; end if;
  update public.ai_creator_packages set price = _price, active = _active where id = _package;
  perform public.audit('update_package', 'ai_package', _package, null, jsonb_build_object('price', jsonb_build_array(before.price, _price), 'active', jsonb_build_array(before.active, _active)));
end $$;

create or replace function public.admin_refund_order(_order uuid, _reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.v2_ai_orders;
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Admins only.'; end if;
  if length(btrim(coalesce(_reason, ''))) < 3 then raise exception 'Give a reason for the refund.'; end if;
  select * into o from public.v2_ai_orders where id = _order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status not in ('in_production','ready_for_review','revision_requested','approved') then raise exception 'Only paid, unfinished orders can be refunded.'; end if;
  update public.payments set status = 'refunded', refunded_at = now() where order_id = o.id and status = 'succeeded';
  update public.order_charges set status = 'void' where order_id = o.id and status = 'unpaid';
  perform set_config('qola.internal', 'on', true);
  update public.v2_ai_orders set status = 'refunded', cancelled_at = now() where id = o.id returning * into o;
  perform public.order_event(o.id, 'refunded', 'Marked refunded by Qolabrate (simulated payment, no real money moved): ' || left(_reason, 500));
  perform public.order_notify(o, 'Your order was marked refunded by Qolabrate.');
  perform set_config('qola.internal', 'off', true);
  perform public.audit('refund_order', 'ai_order', o.id, _reason, jsonb_build_object('amount', o.brand_total));
end $$;

create or replace function public.admin_revenue_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only.'; end if;
  select jsonb_build_object(
    'orders_paid', (select count(*) from public.payments where kind = 'order' and status = 'succeeded'),
    'gross_order_value', (select coalesce(sum(amount), 0) from public.payments where kind = 'order' and status = 'succeeded'),
    'commission', (select coalesce(sum(platform_fee), 0) from public.payments where kind = 'order' and status = 'succeeded'),
    'premium', (select coalesce(sum(amount), 0) from public.payments where kind = 'charge' and status = 'succeeded'),
    'subscriptions', (select coalesce(sum(amount), 0) from public.payments where kind = 'subscription' and status = 'succeeded'),
    'processing_fees', (select coalesce(sum(processing_fee), 0) from public.payments where status = 'succeeded'),
    'generation_costs', (select coalesce(sum(generation_cost_estimate), 0) from public.v2_ai_orders),
    'refunded', (select coalesce(sum(amount), 0) from public.payments where status = 'refunded'),
    'orders_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from public.v2_ai_orders group by status) x)
  ) into r;
  return r;
end $$;

create or replace function public.private_path_allowed(_name text, _uid uuid, _write boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(_name, '/'); scope uuid;
begin
  if array_length(parts, 1) < 4 then return false; end if;
  begin scope := parts[2]::uuid; exception when others then return false; end;
  if parts[1] = 'order' then
    return not _write and (public.is_order_brand(scope, _uid) or public.is_staff(_uid));
  end if;
  if _write and parts[3] <> _uid::text then return false; end if;
  if parts[1] = 'conv' then return public.is_conversation_member(scope, _uid);
  elsif parts[1] = 'collab' then return public.is_collab_member(scope, _uid);
  end if;
  return false;
end $$;

alter table public.v2_brand_profiles add column if not exists products text;

create or replace function public.account_type_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' or new.is_demo then return new; end if;
  if tg_op = 'INSERT' then
    new.account_type := 'brand';
  elsif new.account_type = 'creator' and old.account_type <> 'creator' then
    raise exception 'Qolabrate creators are AI personas run by the platform. Member accounts are brand accounts.';
  end if;
  return new;
end $$;
create trigger profiles_account_type_guard before insert or update of account_type on public.v2_profiles
  for each row execute function public.account_type_guard();

create or replace function public.applications_closed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  raise exception 'Campaign applications are closed: Qolabrate now works with AI creators. Create a campaign and pick an AI creator instead.';
end $$;
create trigger applications_closed before insert on public.v2_applications for each row execute function public.applications_closed();

insert into public.ai_creators (id, slug, name, tagline, bio, personality, style_prompt, voice_prompt, niches, audiences, content_styles, formats, languages, avatar_url, portfolio, usage_terms, max_active_orders) values
('a1000000-0000-4000-8000-000000000001','aria-sen','Aria Sen','Minimal, editorial fashion for urban India',
 'Aria is an AI-generated fashion persona created by Qolabrate. She styles clothing, accessories and footwear in clean editorial looks for city audiences.',
 'Confident, understated, detail-obsessed. Speaks in short, polished lines.',
 'virtual fashion model Aria: South Asian woman, sleek black bob, minimalist styling, editorial studio lighting, neutral gray and black palette',
 'polished, concise, aspirational; light use of emoji; ends with a soft call to action',
 '{Fashion,Lifestyle,Beauty}','{gen z,women,students,urban,young professionals}','{editorial,minimal,luxury,street style}','{image,caption,script}','{English,Hindi}',
 '/__l5e/assets-v1/953b0928-cf0b-4ce9-8f6b-6ad1a79310cf/ai-aria.jpg',
 '[{"url":"/__l5e/assets-v1/953b0928-cf0b-4ce9-8f6b-6ad1a79310cf/ai-aria.jpg","caption":"Persona portrait"},{"url":"/__l5e/assets-v1/31f782ba-6d0d-4068-aefc-6b1290cf39d8/demo-fashion-1.jpg","caption":"Sample look"},{"url":"/__l5e/assets-v1/7c820f9f-bb06-487b-b1c7-15fd63c62e3f/demo-fashion-2.jpg","caption":"Sample look"}]',
 'AI-generated persona operated by Qolabrate. Posts must be disclosed as AI-generated and as advertising where required. No political, adult, tobacco, gambling or misleading claims.', 8),
('a1000000-0000-4000-8000-000000000002','kai-reddy','Kai Reddy','Honest gadget explainers and unboxings',
 'Kai is an AI-generated tech persona created by Qolabrate. He explains phones, laptops, apps and smart-home gear in plain language.',
 'Curious, upbeat, a little nerdy. Explains one key benefit at a time.',
 'virtual tech reviewer Kai: young man with round glasses and curly hair, charcoal hoodie, clean gray studio, crisp product lighting',
 'friendly explainer tone, clear benefits, no hype words, one emoji at most',
 '{Tech,Gaming,Education}','{tech enthusiasts,students,gamers,professionals,men}','{review,explainer,clean,product demo}','{image,caption,script}','{English,Hindi,Telugu}',
 '/__l5e/assets-v1/97d09e90-53a3-4cb1-8501-c71a6003f4e2/ai-kai.jpg',
 '[{"url":"/__l5e/assets-v1/97d09e90-53a3-4cb1-8501-c71a6003f4e2/ai-kai.jpg","caption":"Persona portrait"},{"url":"/__l5e/assets-v1/06b4bded-e068-4807-b643-1ac3348c3873/demo-tech-1.jpg","caption":"Sample product shot"},{"url":"/__l5e/assets-v1/8c8ea47b-3d57-41cb-9fa7-f3daa3007b03/demo-tech-2.jpg","caption":"Sample product shot"}]',
 'AI-generated persona operated by Qolabrate. Claims must be accurate and supplied by the brand. Posts must be disclosed as AI-generated and as advertising where required.', 10),
('a1000000-0000-4000-8000-000000000003','maya-fit','Maya Fit','High-energy fitness and wellness content',
 'Maya is an AI-generated fitness persona created by Qolabrate. She promotes activewear, supplements with approved claims, fitness apps and healthy routines.',
 'Energetic, encouraging, practical. Loves small daily wins.',
 'virtual fitness coach Maya: athletic woman with long braids in black sportswear, bright minimal gym, energetic natural light',
 'motivating and warm, short punchy sentences, 2–3 relevant hashtags',
 '{Fitness,Lifestyle,Food}','{fitness,women,young adults,health conscious,athletes}','{energetic,motivational,bright,routine}','{image,caption,script}','{English,Hindi}',
 '/__l5e/assets-v1/4093e9b7-708e-4e5d-af0a-d06dac8603e0/ai-maya.jpg',
 '[{"url":"/__l5e/assets-v1/4093e9b7-708e-4e5d-af0a-d06dac8603e0/ai-maya.jpg","caption":"Persona portrait"},{"url":"/__l5e/assets-v1/7b6495cb-1d91-4fd2-a87d-c328f70f1657/demo-fitness-1.jpg","caption":"Sample workout shot"},{"url":"/__l5e/assets-v1/a15f041f-3149-4048-af44-74550d73022c/demo-fitness-2.jpg","caption":"Sample workout shot"}]',
 'AI-generated persona operated by Qolabrate. No medical or weight-loss guarantees. Posts must be disclosed as AI-generated and as advertising where required.', 10),
('a1000000-0000-4000-8000-000000000004','chef-dev','Chef Dev','Warm home-kitchen food stories',
 'Dev is an AI-generated chef persona created by Qolabrate. He features packaged foods, kitchen appliances, spices and restaurants in homely recipe moments.',
 'Warm, generous, fatherly humour. Every post feels like a family kitchen.',
 'virtual chef Dev: cheerful Indian man in his 40s with a short beard and white apron, bright modern home kitchen, warm natural light, fresh ingredients',
 'warm storytelling, sensory food words, festive when relevant, Hinglish touches allowed',
 '{Food,Lifestyle}','{families,home cooks,parents,foodies}','{warm,homely,recipe,festive}','{image,caption,script}','{English,Hindi,Marathi}',
 '/__l5e/assets-v1/70574848-1b06-4108-bb79-026f3faadb44/ai-dev.jpg',
 '[{"url":"/__l5e/assets-v1/70574848-1b06-4108-bb79-026f3faadb44/ai-dev.jpg","caption":"Persona portrait"},{"url":"/__l5e/assets-v1/32415772-0206-4e9e-8f77-ccef8e1105ef/demo-food-1.jpg","caption":"Sample dish"},{"url":"/__l5e/assets-v1/d4dd2a06-847b-40ff-a81c-37bf2f6e4e29/demo-food-2.jpg","caption":"Sample dish"}]',
 'AI-generated persona operated by Qolabrate. Nutrition claims must come from the brand. Posts must be disclosed as AI-generated and as advertising where required.', 12),
('a1000000-0000-4000-8000-000000000005','zoya-wanders','Zoya Wanders','Cinematic travel and stays',
 'Zoya is an AI-generated travel persona created by Qolabrate. She features hotels, travel gear, airlines and destinations in golden-hour scenes.',
 'Dreamy, adventurous, observant. Writes like a postcard.',
 'virtual travel creator Zoya: young woman with long wavy dark hair and a linen shirt, scenic coastal or mountain locations, golden hour cinematic light',
 'evocative and calm, first-person travel diary tone, location-first',
 '{Travel,Lifestyle}','{travellers,couples,young professionals,adventure}','{cinematic,golden hour,aspirational,storytelling}','{image,caption}','{English}',
 '/__l5e/assets-v1/4bb073d7-7789-4cd2-b0cd-db2efa869968/ai-zoya.jpg',
 '[{"url":"/__l5e/assets-v1/4bb073d7-7789-4cd2-b0cd-db2efa869968/ai-zoya.jpg","caption":"Persona portrait"},{"url":"/__l5e/assets-v1/f02ccd9b-8396-4089-b0ab-4abaabe6f576/demo-travel-1.jpg","caption":"Sample destination"},{"url":"/__l5e/assets-v1/bf37bae2-82f4-470c-aa7d-91e3ec11ebfb/demo-travel-2.jpg","caption":"Sample destination"}]',
 'AI-generated persona operated by Qolabrate. Scenes are illustrative, not real visits. Posts must be disclosed as AI-generated and as advertising where required.', 8),
('a1000000-0000-4000-8000-000000000006','luna-glow','Luna Glow','Clean, soft skincare and beauty',
 'Luna is an AI-generated beauty persona created by Qolabrate. She features skincare, makeup and haircare in soft, clean product moments.',
 'Gentle, knowledgeable, calm. Focuses on routines rather than miracles.',
 'virtual beauty creator Luna: East Asian woman with glowing skin and hair tied back, soft beige-gray studio, diffused beauty lighting, minimal props',
 'soft and reassuring, routine steps, ingredient-led, no miracle claims',
 '{Beauty,Fashion}','{women,skincare,gen z,millennials}','{clean,soft,minimal,luxury}','{image,caption}','{English,Hindi}',
 '/__l5e/assets-v1/cb26d1f6-0c37-40e5-861f-1de2532c2ed4/ai-luna.jpg',
 '[{"url":"/__l5e/assets-v1/cb26d1f6-0c37-40e5-861f-1de2532c2ed4/ai-luna.jpg","caption":"Persona portrait"},{"url":"/__l5e/assets-v1/877fefd4-89f9-4411-8f54-b613e90baa6c/demo-beauty-1.jpg","caption":"Sample product shot"},{"url":"/__l5e/assets-v1/d54f4030-e3af-4412-b5d1-a3c803066fd2/demo-beauty-2.jpg","caption":"Sample product shot"}]',
 'AI-generated persona operated by Qolabrate. No before/after or medical claims. Posts must be disclosed as AI-generated and as advertising where required.', 8),
('a1000000-0000-4000-8000-000000000007','rex-arcade','Rex Arcade','Moody gaming setups and launches',
 'Rex is an AI-generated gaming persona created by Qolabrate. He features games, peripherals, snacks and streaming gear in moody setups.',
 'Laid-back, witty, competitive. Talks like a teammate.',
 'virtual gamer Rex: young man with bleached short hair and over-ear headphones, dark gaming room with subtle monitor glow, neutral moody tones',
 'casual gamer slang (light), witty one-liners, meme-aware but brand safe',
 '{Gaming,Tech}','{gamers,gen z,teens,esports,men}','{moody,neon,edgy,meme}','{image,caption,script}','{English,Hindi}',
 '/__l5e/assets-v1/053a24e4-d1a1-4d26-994d-e50e240ceeeb/ai-rex.jpg',
 '[{"url":"/__l5e/assets-v1/053a24e4-d1a1-4d26-994d-e50e240ceeeb/ai-rex.jpg","caption":"Persona portrait"},{"url":"/__l5e/assets-v1/5576a0e6-7fce-447a-882e-6535becfde5a/demo-gaming-1.jpg","caption":"Sample setup"},{"url":"/__l5e/assets-v1/8946aa15-e1c6-45ab-8525-6ec0fb00d3bf/demo-gaming-2.jpg","caption":"Sample setup"}]',
 'AI-generated persona operated by Qolabrate. No gambling, betting or loot-box promotion. Posts must be disclosed as AI-generated and as advertising where required.', 10),
('a1000000-0000-4000-8000-000000000008','nora-capital','Nora Capital','Clear business and money explainers',
 'Nora is an AI-generated business persona created by Qolabrate. She features fintech apps, B2B tools, courses and professional services.',
 'Authoritative, calm, clear. Turns complex offers into three simple points.',
 'virtual business creator Nora: confident woman in her 40s with short silver-streaked hair and a tailored gray blazer, modern office, soft daylight',
 'clear professional tone, numbered takeaways, no financial guarantees',
 '{Business,Education,Tech}','{professionals,founders,investors,small business}','{authoritative,clean,explainer,corporate}','{image,caption,script}','{English}',
 '/__l5e/assets-v1/9688a6aa-8ebc-46ec-9e11-b939d2b40a3b/ai-nora.jpg',
 '[{"url":"/__l5e/assets-v1/9688a6aa-8ebc-46ec-9e11-b939d2b40a3b/ai-nora.jpg","caption":"Persona portrait"},{"url":"/__l5e/assets-v1/a79cab15-6a9b-48d0-9a8f-e87a4f05e3fa/demo-business-1.jpg","caption":"Sample workspace"},{"url":"/__l5e/assets-v1/40084716-606e-4f93-8208-18218fa3e7dc/demo-business-2.jpg","caption":"Sample workspace"}]',
 'AI-generated persona operated by Qolabrate. No investment advice or return guarantees. Posts must be disclosed as AI-generated and as advertising where required.', 8)
on conflict (id) do nothing;

insert into public.ai_creator_packages (id, creator_id, name, description, image_count, caption_count, script_count, price, revisions_included, extra_revision_price, turnaround_days, usage_rights, usage_months, extended_rights_price, sort)
select
  ('a2000000-0000-4000-8000-0000000000' || lpad((g.n * 3 + k.i)::text, 2, '0'))::uuid,
  c.id, k.name, k.descr,
  k.img, k.cap, case when 'script' = any(c.formats) then k.scr else 0 end,
  (round(k.base * g.mult / 100.0) * 100)::int,
  k.rev, (round(k.extra * g.mult / 50.0) * 50)::int, k.days, k.rights, k.months, (round(k.ext * g.mult / 100.0) * 100)::int, k.i
from (values
  (0, 'a1000000-0000-4000-8000-000000000001'::uuid, 1.2),
  (1, 'a1000000-0000-4000-8000-000000000002'::uuid, 1.0),
  (2, 'a1000000-0000-4000-8000-000000000003'::uuid, 0.9),
  (3, 'a1000000-0000-4000-8000-000000000004'::uuid, 0.8),
  (4, 'a1000000-0000-4000-8000-000000000005'::uuid, 1.1),
  (5, 'a1000000-0000-4000-8000-000000000006'::uuid, 1.15),
  (6, 'a1000000-0000-4000-8000-000000000007'::uuid, 0.85),
  (7, 'a1000000-0000-4000-8000-000000000008'::uuid, 1.3)
) as g(n, cid, mult)
join public.ai_creators c on c.id = g.cid
cross join (values
  (1, 'Starter', 'One branded image with a ready-to-post caption.', 1, 1, 0, 3000, 1, 500, 3, 'Organic social media', 6, 1500),
  (2, 'Standard', 'Two images and two captions for a short campaign.', 2, 2, 0, 5000, 2, 750, 4, 'Organic social media', 6, 2500),
  (3, 'Campaign', 'Four images, four captions and a short-video script.', 4, 4, 1, 12000, 3, 1000, 6, 'Organic and paid social, website', 12, 5000)
) as k(i, name, descr, img, cap, scr, base, rev, extra, days, rights, months, ext)
on conflict (id) do nothing;