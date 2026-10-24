CREATE TABLE public.ai_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id text NOT NULL,
  package_name text NOT NULL,
  package_price numeric NOT NULL,
  fee numeric NOT NULL,
  total numeric NOT NULL,
  brief text NOT NULL CHECK (char_length(brief) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment','in_production','ready_for_review','revision_requested','completed','cancelled')),
  revisions_used integer NOT NULL DEFAULT 0,
  revisions_allowed integer NOT NULL DEFAULT 2,
  revision_note text,
  delivery jsonb,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  review text,
  paid_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_orders_brand_idx ON public.ai_orders(brand_id, created_at DESC);
GRANT SELECT ON public.ai_orders TO authenticated;
GRANT ALL ON public.ai_orders TO service_role;
ALTER TABLE public.ai_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brands read own orders" ON public.ai_orders FOR SELECT TO authenticated USING (brand_id = auth.uid());