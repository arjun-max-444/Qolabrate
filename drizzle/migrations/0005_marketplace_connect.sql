ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text NOT NULL DEFAULT '';
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS is_agency boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.public_creators(_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, full_name text, headline text, specialization text, bio text, location text, skills jsonb, categories jsonb, languages jsonb, rate numeric, currency text, instagram jsonb, youtube jsonb, total_reach bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT p.id, p.full_name, coalesce(cp.details->>'headline',''), coalesce(cp.specialization,''), coalesce(cp.bio,''), coalesce(cp.location,''),
 coalesce(cp.skills,'[]'::jsonb), coalesce(cp.details->'categories','[]'::jsonb), coalesce(cp.details->'languages','[]'::jsonb),
 nullif(cp.details->>'rate','')::numeric, coalesce(cp.details->>'currency','INR'),
 (SELECT to_jsonb(s) - 'user_id' - 'id' FROM creator_social_accounts s WHERE s.user_id=p.id AND s.platform='instagram'),
 (SELECT to_jsonb(s) - 'user_id' - 'id' FROM creator_social_accounts s WHERE s.user_id=p.id AND s.platform='youtube'),
 coalesce((SELECT sum(follower_count) FROM creator_social_accounts s WHERE s.user_id=p.id),0)::bigint
FROM profiles p JOIN user_roles r ON r.user_id=p.id AND r.role='creator'
LEFT JOIN creator_profiles cp ON cp.user_id=p.id
WHERE p.account_status='active' AND (_id IS NULL OR p.id=_id) AND (_id IS NOT NULL OR cp.user_id IS NOT NULL)
ORDER BY 14 DESC LIMIT 200 $$;
GRANT EXECUTE ON FUNCTION public.public_creators(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.party_names(_ids uuid[])
RETURNS TABLE(id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT p.id, coalesce(nullif(b.company_name,''), nullif(p.full_name,''), 'Member') FROM profiles p LEFT JOIN brand_profiles b ON b.user_id=p.id WHERE p.id = ANY(_ids) $$;
GRANT EXECUTE ON FUNCTION public.party_names(uuid[]) TO authenticated;

-- Contact details only after acceptance and only to the two parties
CREATE OR REPLACE FUNCTION public.deal_contacts(_kind text, _id uuid)
RETURNS TABLE(brand_email text, brand_whatsapp text, creator_email text, creator_whatsapp text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b uuid; c uuid; st text; BEGIN
IF _kind='offer' THEN SELECT o.brand_id,o.creator_id,o.status INTO b,c,st FROM offers o WHERE o.id=_id;
ELSE SELECT ca.brand_id,a.creator_id,a.status INTO b,c,st FROM applications a JOIN campaigns ca ON ca.id=a.campaign_id WHERE a.id=_id; END IF;
IF st IS DISTINCT FROM 'accepted' OR auth.uid() NOT IN (b,c) THEN RETURN; END IF;
RETURN QUERY SELECT pb.email, pb.whatsapp, pc.email, pc.whatsapp FROM profiles pb, profiles pc WHERE pb.id=b AND pc.id=c; END $$;
GRANT EXECUTE ON FUNCTION public.deal_contacts(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify(_user uuid, _title text, _body text, _link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
INSERT INTO notifications(user_id,title,body,link) VALUES(_user,_title,_body,_link) $$;
REVOKE ALL ON FUNCTION public.notify(uuid,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN
IF TG_OP='INSERT' THEN
  IF (SELECT count(*) FROM offers WHERE brand_id=NEW.brand_id AND created_at > now()-interval '1 day') >= 20 THEN RAISE EXCEPTION 'Daily offer limit reached (20 per day)'; END IF;
  IF NOT has_role(NEW.creator_id,'creator') THEN RAISE EXCEPTION 'Offers can only be sent to creators'; END IF;
  IF NEW.campaign_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM campaigns WHERE id=NEW.campaign_id AND brand_id=NEW.brand_id) THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
  PERFORM notify(NEW.creator_id,'New offer','A brand sent you an offer.','/creator/inbox');
  RETURN NEW; END IF;
IF NEW.brand_id<>OLD.brand_id OR NEW.creator_id<>OLD.creator_id OR NEW.message<>OLD.message OR NEW.budget IS DISTINCT FROM OLD.budget OR NEW.currency<>OLD.currency OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id THEN RAISE EXCEPTION 'Only status can change'; END IF;
IF NEW.status<>OLD.status THEN
  IF OLD.status<>'pending' THEN RAISE EXCEPTION 'Offer already closed'; END IF;
  IF auth.uid()=OLD.creator_id AND NEW.status IN ('accepted','declined') THEN PERFORM notify(OLD.brand_id,'Offer '||NEW.status,'A creator '||NEW.status||' your offer.','/brand/inbox');
  ELSIF auth.uid()=OLD.brand_id AND NEW.status='withdrawn' THEN PERFORM notify(OLD.creator_id,'Offer withdrawn','A brand withdrew its offer.','/creator/inbox');
  ELSE RAISE EXCEPTION 'Not allowed'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_offer BEFORE INSERT OR UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.guard_offer();

CREATE OR REPLACE FUNCTION public.guard_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE b uuid; BEGIN
SELECT brand_id INTO b FROM campaigns WHERE id=coalesce(NEW.campaign_id,OLD.campaign_id);
IF TG_OP='INSERT' THEN PERFORM notify(b,'New application','A creator applied to your campaign.','/brand/inbox'); RETURN NEW; END IF;
IF NEW.creator_id<>OLD.creator_id OR NEW.campaign_id<>OLD.campaign_id OR NEW.pitch<>OLD.pitch OR NEW.quote IS DISTINCT FROM OLD.quote THEN RAISE EXCEPTION 'Only status can change'; END IF;
IF NEW.status<>OLD.status THEN
  IF OLD.status<>'pending' THEN RAISE EXCEPTION 'Application already closed'; END IF;
  IF auth.uid()=b AND NEW.status IN ('accepted','rejected') THEN PERFORM notify(OLD.creator_id,'Application '||NEW.status,'Your application was '||NEW.status||'.','/creator/inbox');
  ELSIF auth.uid()=OLD.creator_id AND NEW.status='withdrawn' THEN NULL;
  ELSE RAISE EXCEPTION 'Not allowed'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_application BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.guard_application();