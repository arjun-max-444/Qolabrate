CREATE TABLE IF NOT EXISTS public.creators(id uuid primary key default gen_random_uuid(), user_id uuid unique, name text not null default '', handle text, niches text[] not null default '{}', platforms text[] not null default '{}', followers int not null default 0, engagement_rate numeric not null default 0, location text not null default '', languages text[] not null default '{}', bio text, avatar_url text, is_demo boolean not null default false, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS public.brands(id uuid primary key default gen_random_uuid(), user_id uuid unique, name text not null default '', niches text[] not null default '{}', platforms text[] not null default '{}', min_followers int not null default 0, max_followers int not null default 10000000, budget int, location text not null default '', languages text[] not null default '{}', bio text, avatar_url text, is_demo boolean not null default false, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS public.collab_requests(id uuid primary key default gen_random_uuid(), from_user uuid not null, target_kind text not null check (target_kind in ('creator','brand')), target_id uuid not null, message text not null default '', status text not null default 'pending', created_at timestamptz default now(), unique(from_user, target_kind, target_id));
GRANT SELECT ON public.creators, public.brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creators, public.brands, public.collab_requests TO authenticated;
GRANT ALL ON public.creators, public.brands, public.collab_requests TO service_role;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY creators_read ON public.creators FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY creators_own_insert ON public.creators FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_demo = false AND public.has_role(auth.uid(),'creator'));
CREATE POLICY creators_own_update ON public.creators FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND is_demo = false);
CREATE POLICY creators_own_delete ON public.creators FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY brands_read ON public.brands FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY brands_own_insert ON public.brands FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_demo = false AND public.has_role(auth.uid(),'brand'));
CREATE POLICY brands_own_update ON public.brands FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND is_demo = false);
CREATE POLICY brands_own_delete ON public.brands FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY collab_read ON public.collab_requests FOR SELECT TO authenticated USING (from_user = auth.uid()
  OR EXISTS (SELECT 1 FROM public.creators c WHERE target_kind='creator' AND c.id=target_id AND c.user_id=auth.uid())
  OR EXISTS (SELECT 1 FROM public.brands b WHERE target_kind='brand' AND b.id=target_id AND b.user_id=auth.uid()));
CREATE POLICY collab_insert ON public.collab_requests FOR INSERT TO authenticated WITH CHECK (from_user = auth.uid() AND status='pending');
CREATE POLICY collab_delete ON public.collab_requests FOR DELETE TO authenticated USING (from_user = auth.uid());

INSERT INTO public.creators(name,handle,niches,platforms,followers,engagement_rate,location,languages,bio,is_demo) VALUES
('Nikhil Reddy','@nikhil_reddy14','{Fashion}','{LinkedIn,Instagram,TikTok}',246316,4.9,'Hyderabad','{Tamil}','Street style & affordable fashion hauls',true),
('Meera Menon','@meera_menon54','{Finance,Food}','{X}',835392,6.2,'Hyderabad','{Marathi}','Personal finance and investing basics',true),
('Arjun Iyer','@arjun_iyer46','{Fitness,Gaming}','{LinkedIn,TikTok}',2837,8.0,'Ahmedabad','{Hindi,Tamil,English}','Home workouts and nutrition tips',true),
('Kavya Iyer','@kavya_iyer91','{Music}','{Instagram}',9059,6.8,'Chennai','{Tamil}','Covers, originals and music production',true),
('Diya Singh','@diya_singh46','{Travel}','{TikTok}',57819,7.1,'Mumbai','{Telugu,Kannada,Malayalam}','Budget travel guides and hidden gems',true),
('Meera Patel','@meera_patel42','{Lifestyle,Parenting}','{YouTube}',330283,8.1,'Pune','{Kannada,English}','Daily vlogs, home and wellness',true),
('Rohan Mehta','@rohan_mehta51','{Finance}','{X,YouTube,LinkedIn}',37869,2.6,'Jaipur','{Kannada,Malayalam,Bengali}','Personal finance and investing basics',true),
('Neha Mehta','@neha_mehta97','{Finance,Food}','{Instagram}',3133,2.7,'Delhi','{Marathi,Kannada,English}','Personal finance and investing basics',true),
('Kabir Singh','@kabir_singh88','{Finance}','{Instagram,TikTok,X}',6334,4.2,'Chennai','{Telugu,Tamil}','Personal finance and investing basics',true),
('Aarav Verma','@aarav_verma81','{Parenting,Education}','{LinkedIn,YouTube}',8241,2.7,'Delhi','{English,Kannada,Telugu}','Parenting hacks and family content',true),
('Pooja Sharma','@pooja_sharma31','{Beauty}','{Instagram,LinkedIn,TikTok}',9198,5.4,'Mumbai','{Telugu,Hindi,Malayalam}','Skincare routines and honest product reviews',true),
('Pooja Menon','@pooja_menon89','{Fitness,Music}','{TikTok}',665492,4.7,'Pune','{Bengali,English}','Home workouts and nutrition tips',true),
('Meera Nair','@meera_nair1','{Beauty,Music}','{Instagram}',6537,3.3,'Hyderabad','{Hindi,Kannada}','Skincare routines and honest product reviews',true),
('Meera Iyer','@meera_iyer74','{Music}','{YouTube,X}',858490,8.0,'Bengaluru','{Hindi}','Covers, originals and music production',true),
('Tanvi Singh','@tanvi_singh83','{Tech}','{Instagram}',806073,4.7,'Pune','{Tamil}','Gadget reviews and tech explainers',true),
('Rohan Nair','@rohan_nair32','{Education}','{X}',34050,8.0,'Jaipur','{English}','Study tips and career guidance',true),
('Nikhil Menon','@nikhil_menon63','{Fashion}','{YouTube,X}',40982,8.7,'Delhi','{English,Tamil}','Street style & affordable fashion hauls',true),
('Karan Mehta','@karan_mehta38','{Lifestyle,Finance}','{Instagram}',7422,6.1,'Jaipur','{Malayalam}','Daily vlogs, home and wellness',true),
('Ananya Sharma','@ananya_sharma66','{Finance}','{YouTube}',9531,2.0,'Mumbai','{Tamil,Bengali,English}','Personal finance and investing basics',true),
('Varun Nair','@varun_nair75','{Finance}','{LinkedIn,TikTok,YouTube}',539589,3.1,'Pune','{Kannada}','Personal finance and investing basics',true),
('Kabir Patel','@kabir_patel2','{Music}','{LinkedIn,Instagram}',5745,2.1,'Bengaluru','{Kannada,Hindi,Telugu}','Covers, originals and music production',true),
('Vivaan Mehta','@vivaan_mehta79','{Food,Fitness}','{LinkedIn,Instagram,TikTok}',81200,8.0,'Chennai','{Hindi,Bengali,Telugu}','Street food, recipes and restaurant reviews',true),
('Diya Mehta','@diya_mehta27','{Beauty}','{TikTok,YouTube,LinkedIn}',395442,6.6,'Chennai','{Bengali,Telugu,English}','Skincare routines and honest product reviews',true),
('Vivaan Joshi','@vivaan_joshi82','{Gaming}','{YouTube,X}',2361,5.9,'Kolkata','{English,Bengali,Marathi}','Mobile gaming streams and tutorials',true),
('Manish Mehta','@manish_mehta19','{Fitness}','{YouTube,Instagram}',710805,4.0,'Hyderabad','{Tamil,Malayalam}','Home workouts and nutrition tips',true),
('Meera Joshi','@meera_joshi20','{Beauty,Finance}','{YouTube}',750810,9.3,'Delhi','{English,Hindi}','Skincare routines and honest product reviews',true),
('Divya Mehta','@divya_mehta35','{Tech}','{Instagram}',5372,4.6,'Hyderabad','{Tamil,Hindi}','Gadget reviews and tech explainers',true),
('Rahul Gupta','@rahul_gupta85','{Travel}','{X}',9137,4.1,'Mumbai','{Malayalam,Bengali}','Budget travel guides and hidden gems',true),
('Siddharth Singh','@siddharth_singh34','{Music}','{LinkedIn}',6392,9.2,'Chennai','{Hindi}','Covers, originals and music production',true),
('Riya Singh','@riya_singh15','{Tech}','{LinkedIn,YouTube}',735656,3.5,'Kolkata','{Tamil}','Gadget reviews and tech explainers',true),
('Priya Singh','@priya_singh85','{Beauty}','{TikTok}',53279,5.6,'Kolkata','{Marathi,Malayalam}','Skincare routines and honest product reviews',true),
('Sneha Menon','@sneha_menon23','{Fitness,Parenting}','{LinkedIn,TikTok,YouTube}',810219,5.9,'Hyderabad','{Kannada,Hindi}','Home workouts and nutrition tips',true),
('Neha Kapoor','@neha_kapoor87','{Finance}','{LinkedIn}',70946,5.3,'Delhi','{Hindi,Telugu,Kannada}','Personal finance and investing basics',true),
('Tanvi Joshi','@tanvi_joshi19','{Finance,Food}','{Instagram}',7511,3.5,'Ahmedabad','{Hindi,Tamil,Marathi}','Personal finance and investing basics',true),
('Nikhil Das','@nikhil_das19','{Food}','{Instagram,LinkedIn,YouTube}',5145,3.3,'Jaipur','{English,Kannada}','Street food, recipes and restaurant reviews',true),
('Meera Mehta','@meera_mehta72','{Beauty}','{TikTok,X,LinkedIn}',800005,8.0,'Jaipur','{Bengali,Hindi}','Skincare routines and honest product reviews',true),
('Divya Naidu','@divya_naidu36','{Lifestyle}','{X,YouTube,LinkedIn}',980660,5.0,'Chennai','{Kannada}','Daily vlogs, home and wellness',true),
('Arjun Gupta','@arjun_gupta91','{Education,Fitness}','{Instagram}',3894,4.8,'Pune','{Bengali,Tamil,English}','Study tips and career guidance',true),
('Rohan Naidu','@rohan_naidu49','{Gaming,Music}','{Instagram,TikTok}',998348,3.9,'Kolkata','{Tamil,Bengali}','Mobile gaming streams and tutorials',true),
('Neha Rao','@neha_rao60','{Fashion,Parenting}','{LinkedIn}',7563,5.8,'Kolkata','{English,Bengali,Malayalam}','Street style & affordable fashion hauls',true),
('Neha Patel','@neha_patel42','{Lifestyle,Travel}','{X,TikTok}',52906,7.5,'Kolkata','{Hindi,Tamil}','Daily vlogs, home and wellness',true),
('Kavya Sharma','@kavya_sharma32','{Tech,Beauty}','{Instagram}',8399,6.5,'Bengaluru','{Bengali}','Gadget reviews and tech explainers',true),
('Tanvi Reddy','@tanvi_reddy22','{Finance}','{LinkedIn,Instagram,X}',43586,9.2,'Mumbai','{English,Telugu,Kannada}','Personal finance and investing basics',true),
('Tanvi Mehta','@tanvi_mehta32','{Gaming,Food}','{TikTok}',824161,8.3,'Kochi','{English}','Mobile gaming streams and tutorials',true),
('Priya Menon','@priya_menon2','{Gaming}','{X,Instagram}',76317,5.0,'Pune','{Bengali,Malayalam,Hindi}','Mobile gaming streams and tutorials',true),
('Divya Menon','@divya_menon94','{Music,Education}','{TikTok,LinkedIn,Instagram}',73372,8.1,'Mumbai','{Bengali,Hindi}','Covers, originals and music production',true),
('Harsh Rao','@harsh_rao42','{Finance}','{X}',54092,3.2,'Chennai','{Kannada,Bengali}','Personal finance and investing basics',true),
('Karan Menon','@karan_menon53','{Fashion}','{LinkedIn,YouTube}',353080,7.0,'Ahmedabad','{English,Bengali}','Street style & affordable fashion hauls',true),
('Sneha Nair','@sneha_nair61','{Gaming}','{LinkedIn,TikTok,YouTube}',97026,9.5,'Jaipur','{Malayalam,Bengali}','Mobile gaming streams and tutorials',true),
('Rahul Iyer','@rahul_iyer96','{Travel,Beauty}','{YouTube,LinkedIn,Instagram}',7908,7.4,'Chennai','{Kannada,English,Hindi}','Budget travel guides and hidden gems',true),
('Priya Patel','@priya_patel71','{Travel,Finance}','{YouTube,X}',3036,2.3,'Hyderabad','{Kannada,Tamil,Marathi}','Budget travel guides and hidden gems',true),
('Isha Sharma','@isha_sharma52','{Travel}','{Instagram,LinkedIn}',5913,2.7,'Kochi','{Hindi,Bengali}','Budget travel guides and hidden gems',true),
('Diya Menon','@diya_menon49','{Gaming}','{X,TikTok}',336650,8.4,'Kolkata','{English,Kannada}','Mobile gaming streams and tutorials',true),
('Divya Reddy','@divya_reddy31','{Food}','{LinkedIn}',4167,2.1,'Hyderabad','{Bengali,Malayalam}','Street food, recipes and restaurant reviews',true),
('Riya Rao','@riya_rao10','{Travel,Tech}','{YouTube,TikTok,X}',47056,6.2,'Bengaluru','{Hindi,Kannada}','Budget travel guides and hidden gems',true),
('Aditya Mehta','@aditya_mehta77','{Travel}','{LinkedIn,TikTok,YouTube}',17816,2.5,'Chennai','{Marathi,Telugu,Kannada}','Budget travel guides and hidden gems',true),
('Kavya Rao','@kavya_rao78','{Lifestyle,Fashion}','{Instagram,LinkedIn}',66626,3.3,'Kochi','{English,Marathi,Malayalam}','Daily vlogs, home and wellness',true),
('Karan Das','@karan_das57','{Fashion}','{YouTube,X}',644173,6.6,'Ahmedabad','{Bengali}','Street style & affordable fashion hauls',true),
('Isha Gupta','@isha_gupta5','{Gaming}','{Instagram,TikTok}',519904,3.5,'Mumbai','{English,Malayalam}','Mobile gaming streams and tutorials',true),
('Neha Sharma','@neha_sharma98','{Food}','{YouTube}',75338,3.6,'Delhi','{Bengali,Malayalam}','Street food, recipes and restaurant reviews',true),
('Pooja Reddy','@pooja_reddy40','{Fashion}','{Instagram,X,LinkedIn}',6987,3.3,'Mumbai','{Hindi,Malayalam}','Street style & affordable fashion hauls',true),
('Aditya Rao','@aditya_rao59','{Parenting,Travel}','{YouTube,X,Instagram}',5403,8.9,'Jaipur','{Telugu,Marathi,English}','Parenting hacks and family content',true),
('Karan Kapoor','@karan_kapoor39','{Gaming,Finance}','{LinkedIn,X,Instagram}',396578,5.1,'Ahmedabad','{Malayalam,Kannada}','Mobile gaming streams and tutorials',true),
('Harsh Menon','@harsh_menon74','{Gaming}','{YouTube,X}',4636,1.8,'Ahmedabad','{Marathi,Tamil,Malayalam}','Mobile gaming streams and tutorials',true),
('Nikhil Patel','@nikhil_patel13','{Lifestyle}','{Instagram,X}',75836,1.6,'Delhi','{Telugu,English}','Daily vlogs, home and wellness',true),
('Pooja Kapoor','@pooja_kapoor87','{Travel,Lifestyle}','{X,TikTok,LinkedIn}',20527,7.2,'Ahmedabad','{English,Kannada,Bengali}','Budget travel guides and hidden gems',true),
('Neha Reddy','@neha_reddy39','{Music}','{Instagram}',274446,4.1,'Hyderabad','{Malayalam,Telugu}','Covers, originals and music production',true),
('Neha Das','@neha_das49','{Music}','{YouTube,X,TikTok}',182804,2.6,'Ahmedabad','{Kannada,Tamil,Telugu}','Covers, originals and music production',true),
('Tanvi Sharma','@tanvi_sharma57','{Lifestyle}','{LinkedIn,TikTok}',7550,6.6,'Kolkata','{Kannada,Tamil,Telugu}','Daily vlogs, home and wellness',true),
('Rohan Singh','@rohan_singh90','{Lifestyle,Gaming}','{Instagram,X}',57049,3.7,'Kochi','{English,Kannada,Malayalam}','Daily vlogs, home and wellness',true),
('Pooja Naidu','@pooja_naidu29','{Travel}','{YouTube,TikTok,X}',89569,7.5,'Delhi','{Hindi,Malayalam,Marathi}','Budget travel guides and hidden gems',true),
('Ananya Iyer','@ananya_iyer42','{Lifestyle,Tech}','{X,YouTube,Instagram}',27224,2.6,'Jaipur','{Kannada,Marathi}','Daily vlogs, home and wellness',true),
('Isha Iyer','@isha_iyer60','{Lifestyle}','{YouTube}',4417,7.5,'Bengaluru','{Marathi,Bengali,Kannada}','Daily vlogs, home and wellness',true),
('Priya Reddy','@priya_reddy96','{Gaming,Finance}','{TikTok,X,LinkedIn}',486490,9.0,'Mumbai','{Tamil,Bengali,English}','Mobile gaming streams and tutorials',true),
('Riya Mehta','@riya_mehta60','{Education,Music}','{TikTok,X,Instagram}',166287,2.6,'Hyderabad','{Bengali,English}','Study tips and career guidance',true),
('Diya Nair','@diya_nair70','{Education,Lifestyle}','{LinkedIn,YouTube}',879238,8.6,'Mumbai','{Marathi,Telugu}','Study tips and career guidance',true),
('Ananya Verma','@ananya_verma13','{Tech,Education}','{TikTok,LinkedIn,Instagram}',40947,4.7,'Bengaluru','{Bengali}','Gadget reviews and tech explainers',true),
('Rohan Joshi','@rohan_joshi32','{Music}','{LinkedIn}',16629,3.1,'Jaipur','{Tamil}','Covers, originals and music production',true),
('Meera Gupta','@meera_gupta17','{Fitness}','{TikTok,YouTube,Instagram}',6882,6.8,'Hyderabad','{English}','Home workouts and nutrition tips',true),
('Priya Kapoor','@priya_kapoor17','{Food}','{X,Instagram,TikTok}',2129,2.0,'Ahmedabad','{Hindi,Tamil}','Street food, recipes and restaurant reviews',true),
('Siddharth Nair','@siddharth_nair4','{Finance,Parenting}','{X}',580292,8.3,'Kolkata','{Hindi,Tamil,Malayalam}','Personal finance and investing basics',true),
('Rahul Reddy','@rahul_reddy82','{Beauty,Food}','{LinkedIn,TikTok,YouTube}',388375,9.5,'Jaipur','{Bengali,Kannada}','Skincare routines and honest product reviews',true),
('Diya Kapoor','@diya_kapoor56','{Parenting,Music}','{YouTube,X}',7332,4.2,'Ahmedabad','{Marathi,Malayalam}','Parenting hacks and family content',true),
('Diya Gupta','@diya_gupta9','{Gaming,Travel}','{Instagram}',30006,2.2,'Mumbai','{Malayalam,Marathi,Hindi}','Mobile gaming streams and tutorials',true),
('Varun Menon','@varun_menon93','{Education,Beauty}','{TikTok}',56346,6.3,'Pune','{Tamil}','Study tips and career guidance',true),
('Aditya Joshi','@aditya_joshi98','{Lifestyle,Beauty}','{LinkedIn,YouTube}',4868,8.0,'Jaipur','{English,Kannada,Malayalam}','Daily vlogs, home and wellness',true),
('Manish Iyer','@manish_iyer24','{Fashion,Tech}','{LinkedIn}',9549,6.8,'Mumbai','{English}','Street style & affordable fashion hauls',true),
('Vivaan Verma','@vivaan_verma40','{Education,Gaming}','{TikTok,Instagram,X}',54681,2.7,'Kochi','{Hindi}','Study tips and career guidance',true),
('Karan Rao','@karan_rao28','{Music}','{Instagram,TikTok,YouTube}',67939,2.4,'Kochi','{Kannada,English}','Covers, originals and music production',true),
('Meera Singh','@meera_singh98','{Finance,Food}','{TikTok,LinkedIn}',4469,2.5,'Ahmedabad','{Marathi,Hindi,Bengali}','Personal finance and investing basics',true),
('Kabir Menon','@kabir_menon10','{Parenting,Education}','{Instagram,X}',97562,1.6,'Mumbai','{Marathi,Kannada}','Parenting hacks and family content',true),
('Kabir Verma','@kabir_verma22','{Music}','{X,TikTok,Instagram}',63088,5.0,'Mumbai','{Marathi}','Covers, originals and music production',true),
('Varun Singh','@varun_singh22','{Education,Travel}','{LinkedIn}',54500,6.6,'Jaipur','{Tamil,Marathi,Telugu}','Study tips and career guidance',true),
('Priya Verma','@priya_verma26','{Music}','{LinkedIn}',23474,2.7,'Mumbai','{Bengali}','Covers, originals and music production',true),
('Rahul Kapoor','@rahul_kapoor82','{Finance}','{TikTok,LinkedIn,Instagram}',691912,5.0,'Ahmedabad','{Kannada,Marathi}','Personal finance and investing basics',true),
('Ananya Gupta','@ananya_gupta37','{Education,Lifestyle}','{Instagram}',14929,6.4,'Jaipur','{Bengali,Kannada}','Study tips and career guidance',true),
('Kavya Kapoor','@kavya_kapoor42','{Parenting}','{X,YouTube,Instagram}',5684,5.1,'Pune','{Hindi,Kannada,Malayalam}','Parenting hacks and family content',true),
('Meera Verma','@meera_verma47','{Lifestyle}','{TikTok,X}',6293,4.8,'Pune','{English,Marathi,Malayalam}','Daily vlogs, home and wellness',true),
('Nikhil Gupta','@nikhil_gupta93','{Beauty,Finance}','{LinkedIn,YouTube,X}',60667,2.2,'Delhi','{Kannada,Malayalam}','Skincare routines and honest product reviews',true),
('Manish Joshi','@manish_joshi43','{Gaming,Beauty}','{LinkedIn}',494976,2.2,'Kolkata','{Malayalam,English,Telugu}','Mobile gaming streams and tutorials',true);

INSERT INTO public.brands(name,niches,platforms,min_followers,max_followers,budget,location,languages,bio,is_demo) VALUES
('GlowRoot','{Beauty}','{X,YouTube}',10000,50000,15000,'Delhi','{Hindi}','Beauty brand looking for creators to promote our products',true),
('UrbanThread','{Fashion}','{LinkedIn,Instagram,TikTok}',10000,50000,25000,'Kochi','{Marathi}','Fashion brand looking for creators to promote our products',true),
('FitFuel','{Fitness,Music}','{X}',2000,10000,5000,'Kolkata','{Tamil,Bengali}','Fitness brand looking for creators to promote our products',true),
('SpiceTrail','{Food}','{YouTube,LinkedIn}',50000,500000,25000,'Ahmedabad','{Malayalam}','Food brand looking for creators to promote our products',true),
('WanderNest','{Travel}','{TikTok,X}',50000,1000000,100000,'Jaipur','{Telugu,Marathi}','Travel brand looking for creators to promote our products',true),
('ByteBox','{Tech,Travel}','{X}',2000,40000,25000,'Jaipur','{Hindi}','Tech brand looking for creators to promote our products',true),
('PixelPlay','{Gaming}','{X,YouTube}',10000,50000,50000,'Mumbai','{Bengali}','Gaming brand looking for creators to promote our products',true),
('CozyCorner','{Lifestyle}','{LinkedIn,TikTok}',10000,50000,15000,'Kolkata','{Malayalam}','Lifestyle brand looking for creators to promote our products',true),
('LearnLoop','{Education}','{TikTok}',2000,10000,15000,'Delhi','{Kannada}','Education brand looking for creators to promote our products',true),
('CoinCraft','{Finance}','{X,LinkedIn,TikTok}',10000,200000,5000,'Mumbai','{Kannada}','Finance brand looking for creators to promote our products',true),
('BeatBay','{Music}','{LinkedIn,X,Instagram}',2000,10000,25000,'Bengaluru','{Hindi,English}','Music brand looking for creators to promote our products',true),
('TinyTots','{Parenting}','{X,Instagram,LinkedIn}',2000,20000,50000,'Kochi','{Tamil}','Parenting brand looking for creators to promote our products',true),
('Velvet Skin','{Beauty,Fashion}','{TikTok,YouTube,LinkedIn}',50000,250000,50000,'Delhi','{Malayalam}','Beauty brand looking for creators to promote our products',true),
('Kurta Co','{Fashion}','{LinkedIn,Instagram,YouTube}',2000,40000,50000,'Hyderabad','{Malayalam,Telugu}','Fashion brand looking for creators to promote our products',true),
('IronPulse','{Fitness}','{TikTok}',50000,250000,15000,'Mumbai','{Telugu,English}','Fitness brand looking for creators to promote our products',true),
('Chai & Co','{Food}','{YouTube,X,TikTok}',10000,200000,50000,'Delhi','{Hindi}','Food brand looking for creators to promote our products',true),
('TrekMate','{Travel,Food}','{YouTube}',50000,500000,5000,'Pune','{Marathi,Bengali}','Travel brand looking for creators to promote our products',true),
('GadgetGrid','{Tech,Parenting}','{TikTok}',50000,500000,25000,'Hyderabad','{Kannada,English}','Tech brand looking for creators to promote our products',true),
('LevelUp Games','{Gaming}','{X,LinkedIn,YouTube}',10000,100000,15000,'Ahmedabad','{Malayalam,Marathi}','Gaming brand looking for creators to promote our products',true),
('HomeHaven','{Lifestyle}','{X,Instagram,YouTube}',50000,500000,100000,'Delhi','{Malayalam,English}','Lifestyle brand looking for creators to promote our products',true),
('SkillShala','{Education}','{X,LinkedIn}',2000,20000,15000,'Ahmedabad','{Bengali,English}','Education brand looking for creators to promote our products',true),
('WealthWise','{Finance}','{TikTok,Instagram}',50000,500000,5000,'Kolkata','{Telugu,English}','Finance brand looking for creators to promote our products',true),
('SoundWave','{Music}','{Instagram,YouTube}',2000,40000,5000,'Bengaluru','{Malayalam,Tamil}','Music brand looking for creators to promote our products',true),
('BabyBloom','{Parenting}','{X,TikTok,YouTube}',50000,250000,50000,'Mumbai','{Malayalam}','Parenting brand looking for creators to promote our products',true),
('StyleSutra','{Fashion}','{Instagram}',10000,100000,5000,'Delhi','{Marathi,Kannada}','Fashion brand looking for creators to promote our products',true);

UPDATE public.creators SET avatar_url = 'https://ui-avatars.com/api/?background=random&size=256&name=' || replace(name,' ','%20') WHERE is_demo AND avatar_url IS NULL;
UPDATE public.brands SET avatar_url = 'https://ui-avatars.com/api/?background=random&size=256&name=' || replace(replace(name,'&','%26'),' ','%20') WHERE is_demo AND avatar_url IS NULL;