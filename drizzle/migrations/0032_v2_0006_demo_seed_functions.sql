create or replace function public.demo_uuid(_kind text, _n int)
returns uuid language sql immutable set search_path = public as $$
  select md5('qolabrate-demo:' || _kind || ':' || _n)::uuid
$$;

create or replace function public.demo_hash(_seed text, _mod int)
returns int language sql immutable set search_path = public as $$
  select (abs(hashtext(_seed)::bigint) % greatest(_mod, 1))::int
$$;

create or replace function public.seed_demo_content()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cats text[] := array['AI','Tech','Fashion','Lifestyle','Gaming','Fitness','Travel','Education','Business','Beauty','Food'];
  first_names text[] := array['Aarav','Ananya','Rohan','Isha','Kabir','Meera','Vihaan','Diya','Aditya','Saanvi','Reyansh','Kavya','Ishaan','Tara','Dev','Nisha','Kunal','Riya','Siddharth','Pooja','Varun','Sneha','Nikhil','Aditi','Rahul','Zara','Karan','Anika','Yash','Mira','Aryan','Priya','Neel','Simran','Harsh','Tanvi','Omkar','Leela','Farhan','Naina','Samar','Ira','Jay','Avni','Manav','Shreya','Rehan','Kiara','Vikram','Divya','Aman','Sana','Abhay','Rhea','Tejas','Gauri','Imran','Maya','Pranav','Esha','Nakul','Aisha','Raghav','Lavanya','Dhruv','Noor','Sahil','Ritika','Parth','Fatima'];
  last_names text[] := array['Sharma','Iyer','Mehta','Kapoor','Nair','Reddy','Gupta','Das','Bose','Khan','Menon','Joshi','Rao','Malhotra','Pillai','Chopra','Banerjee','Kulkarni','Singh','Shetty','Desai','Verma','Fernandes','Patel','Saxena','Ahmed','Chatterjee','Agarwal','Bhat','Thomas'];
  cities text[] := array['Mumbai','Bengaluru','Delhi','Hyderabad','Chennai','Pune','Kolkata','Jaipur','Ahmedabad','Kochi','Goa','Chandigarh','Indore','Lucknow','Gurugram','Mysuru'];
  brand_names text[] := array['Lumen Labs','ByteForge','Pixelnest','VoltEdge','Orbit Mobile','Gamerzone Gear','Kora Threads','Saffron Studio','Urban Loom','Indigo & Co','Dewdrop Skin','Glow Theory','Neem & Rose','Velvet Muse','Masala Box','Brew Republic','Millet Magic','Tiffin Tales','PulseFit','Stride Athletics','Protein Pantry','FlexNation','Shiksha Plus','CodeCamp India','LinguaLeap','FinWise Academy','Nest & Nook','Calm Corner','Terra Plants','Wander Bags'];
  brand_cats text[] := array['Tech','Tech','Tech','Tech','Tech','Tech','Fashion','Fashion','Fashion','Fashion','Beauty','Beauty','Beauty','Beauty','Food','Food','Food','Food','Fitness','Fitness','Fitness','Fitness','Education','Education','Education','Education','Lifestyle','Lifestyle','Lifestyle','Lifestyle'];
  brand_products text[] := array['Lumen Buds Pro earbuds','Forge X1 mini PC','Nest 4K webcam','VoltEdge 65W charger','Orbit 5G smartphone','Gamerzone Pro headset','linen summer edit','festive kurta collection','everyday denim range','block-print co-ords','Dewdrop niacinamide serum','Glow Theory lip tints','ayurvedic face oil','long-wear kajal','weekly meal kits','cold brew cans','millet snack bars','ready-to-cook curries','PulseFit smart band','Stride running shoes','plant protein powder','home gym kit','JEE crash course','full-stack bootcamp','spoken English app','personal finance course','cane furniture line','meditation app','indoor plant subscription','carry-on luggage'];
  img jsonb := '{"ai":["/__l5e/assets-v1/803af5a1-517b-45d2-b424-a36d2ed2808f/demo-ai-1.jpg","/__l5e/assets-v1/86ca55c7-7d14-4fb6-9b06-ab17ba5d316e/demo-ai-2.jpg"],"beauty":["/__l5e/assets-v1/877fefd4-89f9-4411-8f54-b613e90baa6c/demo-beauty-1.jpg","/__l5e/assets-v1/d54f4030-e3af-4412-b5d1-a3c803066fd2/demo-beauty-2.jpg"],"business":["/__l5e/assets-v1/a79cab15-6a9b-48d0-9a8f-e87a4f05e3fa/demo-business-1.jpg","/__l5e/assets-v1/40084716-606e-4f93-8208-18218fa3e7dc/demo-business-2.jpg"],"education":["/__l5e/assets-v1/8325d8b7-eaef-4a84-bac3-bbed45b8b002/demo-education-1.jpg","/__l5e/assets-v1/9f897518-76e4-4a4e-bfb2-93853fc3d98a/demo-education-2.jpg"],"fashion":["/__l5e/assets-v1/31f782ba-6d0d-4068-aefc-6b1290cf39d8/demo-fashion-1.jpg","/__l5e/assets-v1/7c820f9f-bb06-487b-b1c7-15fd63c62e3f/demo-fashion-2.jpg"],"fitness":["/__l5e/assets-v1/7b6495cb-1d91-4fd2-a87d-c328f70f1657/demo-fitness-1.jpg","/__l5e/assets-v1/a15f041f-3149-4048-af44-74550d73022c/demo-fitness-2.jpg"],"food":["/__l5e/assets-v1/32415772-0206-4e9e-8f77-ccef8e1105ef/demo-food-1.jpg","/__l5e/assets-v1/d4dd2a06-847b-40ff-a81c-37bf2f6e4e29/demo-food-2.jpg"],"gaming":["/__l5e/assets-v1/5576a0e6-7fce-447a-882e-6535becfde5a/demo-gaming-1.jpg","/__l5e/assets-v1/8946aa15-e1c6-45ab-8525-6ec0fb00d3bf/demo-gaming-2.jpg"],"lifestyle":["/__l5e/assets-v1/e8f15dc4-fcb7-412b-aac9-e3e0ed1dc478/demo-lifestyle-1.jpg","/__l5e/assets-v1/b568c943-8fea-4440-9cd3-1365aacc4657/demo-lifestyle-2.jpg"],"tech":["/__l5e/assets-v1/06b4bded-e068-4807-b643-1ac3348c3873/demo-tech-1.jpg","/__l5e/assets-v1/8c8ea47b-3d57-41cb-9fa7-f3daa3007b03/demo-tech-2.jpg"],"travel":["/__l5e/assets-v1/f02ccd9b-8396-4089-b0ab-4abaabe6f576/demo-travel-1.jpg","/__l5e/assets-v1/bf37bae2-82f4-470c-aa7d-91e3ec11ebfb/demo-travel-2.jpg"]}';
  content jsonb := $json${
"AI":{"t":["Tried {a} for {b} this week. Cut my editing time by {n}% and the output still sounds like me.","Hot take: {a} is underrated for {b}. Most people stop at the first prompt, the magic is in the third revision.","My {n}-step workflow for {b} using {a}: draft, critique, rewrite, fact-check, publish.","Spent the weekend testing {a} for {b}. Wins: speed. Misses: nuance. Still a human job to make it good.","If you’re a creator ignoring {a} in 2026, you’re doing {b} the slow way. Here’s how I use it daily.","Built a tiny agent with {a} that handles {b} while I sleep. {n} hours saved last month.","Reminder: {a} won’t replace your taste. Use it for {b}, keep the final call yours.","Ran a blind test: {a} vs my own drafts for {b}. My audience picked the hybrid version {n}% of the time."],"a":["an LLM writing assistant","an open-source model","AI voice cloning","an AI thumbnail generator","auto-captioning tools","AI video upscaling","a local model on my laptop","AI research agents","prompt chaining","AI B-roll generation"],"b":["script writing","YouTube thumbnails","podcast show notes","reel captions","brand pitch decks","client research","multilingual subtitles","newsletter drafts"],"h":["#AI","#GenAI","#AItools","#PromptEngineering","#CreatorEconomy","#FutureOfWork"],"v":["60 seconds: how I script a full reel with {a}.","Watch {a} turn a rough voice note into a finished short.","Behind the scenes of my {a} workflow, no cuts.","Quick demo: {a} in a real client project."],"p":["AI-assisted explainer series for a fintech startup, built with {a}.","Case study: a {a} workflow that doubled a client’s posting cadence.","Prompt library and training session for a D2C brand team using {a}."],"bio":["Making AI practical for creators and small teams. Prompts, workflows and honest tool reviews from {city}.","Ex-product designer turned AI educator. Helping people work smarter with AI. Based in {city}."],"head":"AI educator & creator","skills":["Prompt design","Explainer videos","Scripting"]},
"Tech":{"t":["{n} days with {a} and here’s my honest take: {b} is where it shines.","Unpopular opinion: {a} is overkill for most people. Unless you care about {b}, save your money.","Finally upgraded to {a}. The difference in {b} is wild.","Comparing {a} side by side for {b}. Full review drops Friday.","Under ₹{n}k and still great at {b}? {a} surprised me.","My desk setup in 2026: {a} at the centre, everything tuned for {b}.","Tested {a} for a full week of {b}. Battery, heat, performance — all in the thread.","Asked {n} of you what to review next and {a} won. First impressions: {b} is excellent."],"a":["a foldable phone","the new budget 5G phone","a 34-inch ultrawide","noise-cancelling earbuds","a mechanical keyboard","a mini PC","a smartwatch","a mirrorless camera","a portable SSD","a mesh Wi-Fi kit"],"b":["low-light video","gaming at 120fps","all-day battery","colour accuracy","coding sessions","travel vlogging","audio quality","multitasking"],"h":["#Tech","#TechReview","#Gadgets","#DeskSetup","#Unboxing","#TechIndia"],"v":["Unboxing {a} in under a minute.","Is {a} worth it? 45-second verdict.","Drop test, camera test, battery test: {a}.","Setting up {a} from scratch."],"p":["Launch review series for a consumer electronics brand: {a}.","Long-form comparison video on {a} — 1.2M views, 14% CTR.","Sponsored tutorial series covering {a} for a retail partner."],"bio":["Honest gadget reviews, no fluff. Phones, laptops and desk setups from {city}.","Engineer by day, tech reviewer by night. Testing so you don’t have to. {city}."],"head":"Tech reviewer","skills":["Product reviews","Unboxing","Video editing"]},
"Fashion":{"t":["Styling {a} {n} ways for {b}. Which look is your favourite?","Thrifted {a} for ₹{n}00 and built a whole {b} outfit around it.","Capsule wardrobe update: {a} is doing all the heavy lifting for {b} this season.","If you only buy one thing for {b}, make it {a}. Trust me.","Sustainable swap of the week: {a} from a local label, perfect for {b}.","Outfit formula for {b}: {a} + clean sneakers + one statement accessory.","Everyone is chasing trends, but {a} in a neutral works for {b} year round.","Packing for {b}? {a} folds flat and never wrinkles. {n} outfits from one carry-on."],"a":["an oversized linen shirt","a handloom kurta","wide-leg trousers","a vintage denim jacket","a block-print co-ord set","white leather sneakers","a silk slip dress","a cropped blazer","chunky silver jewellery","a khadi saree"],"b":["office days","wedding season","college","weekend brunch","a Goa trip","date night","festive season","monsoon commutes"],"h":["#Fashion","#OOTD","#StreetStyle","#SustainableFashion","#StyleTips","#IndianFashion"],"v":["Get ready with me: {a} edition.","Three looks, one {a}, 30 seconds.","Try-on haul featuring {a}.","Styling challenge: {a} for every day of the week."],"p":["Lookbook shoot for a slow-fashion label featuring {a}.","Festive campaign styling for a D2C ethnic wear brand: {a}.","Editorial series on {a} — 3.4M combined reach."],"bio":["Everyday style with a slow-fashion heart. Thrift finds and handloom love from {city}.","Stylist and content creator. Making Indian craft feel modern. {city}."],"head":"Fashion & style creator","skills":["Styling","Lookbooks","Reels"]},
"Lifestyle":{"t":["Small habit, big change: {a} every morning for {n} days. {b} has never felt easier.","Sunday reset: {a}, a clean desk and zero notifications. That’s how I protect {b}.","Things that made my week better: {a}, long walks and finally sorting out {b}.","Moved apartments and {a} made it feel like home in a day. {b} sorted.","Romanticising the ordinary: {a} and a slow start to {b}.","My {n}-minute evening routine starts with {a}. It has fixed my {b}.","Budget-friendly home upgrade: {a} for under ₹{n}00. Huge win for {b}.","Year one of {a}: fewer impulse buys, calmer weekends, better {b}."],"a":["journaling","a no-phone breakfast","indoor plants","meal prepping","a 10k-step walk","a reading corner","digital minimalism","batch cooking","a weekly planner","a gratitude list"],"b":["sleep","focus","mental health","work-life balance","productivity","my budget","creative energy","mornings"],"h":["#Lifestyle","#SlowLiving","#HomeDecor","#DailyRoutine","#Wellness","#Productivity"],"v":["A calm morning with {a}, no talking.","Day in my life: {a} edition.","Five minutes of {a} — come with me.","Room makeover with {a}, start to finish."],"p":["Home decor series for a furniture brand centred on {a}.","Wellness habit challenge with a meditation app: {a}.","Lifestyle content retainer built around {a} for a homeware label."],"bio":["Slow living, small homes and good habits. Sharing my calm corner of {city}.","Home, habits and honest routines. Making the everyday feel special in {city}."],"head":"Lifestyle creator","skills":["Photography","Reels","Storytelling"]},
"Gaming":{"t":["Hit a new rank in {a} last night after {n} hours of grinding. {b} carried me.","Hot take: {a} is the best thing to happen to {b} in years.","Streaming {a} tonight at 9 PM IST. Come for the {b}, stay for the chaos.","My settings for {a}: everything tuned for {b}. Full guide pinned.","{n} hours into {a} and the {b} is still blowing my mind.","Indie gem alert: {a}. If you love {b}, this one is for you.","Tournament recap: our squad placed top {n} in {a}. {b} made the difference.","Controller vs keyboard for {a}? For {b}, I’m switching sides."],"a":["a battle royale","the new open-world RPG","a tactical shooter","an indie roguelike","a racing sim","a mobile MOBA","a co-op survival game","a fighting game","a cozy farming sim","a speedrun category"],"b":["clutch plays","the soundtrack","map awareness","team comms","the art direction","ranked progress","the boss fights","frame-perfect inputs"],"h":["#Gaming","#Esports","#Streamer","#IndianGaming","#GamingSetup","#LiveStream"],"v":["Clutch moment from last night’s {a} stream.","1v4 in {a} — watch till the end.","Ranking every weapon in {a} in 60 seconds.","My {a} setup tour."],"p":["Launch-week stream partnership for {a} — 48k peak viewers.","Esports highlight series for a peripheral brand featuring {a}.","Sponsored tournament hosting for {a}, 2.1M impressions."],"bio":["Variety streamer, FPS addict, cozy-game enjoyer. Live most nights from {city}.","Esports caster and content creator. Guides, highlights and hot takes from {city}."],"head":"Gaming creator & streamer","skills":["Live streaming","Esports commentary","Highlights editing"]},
"Fitness":{"t":["Week {n} of {a}: down 3 kg and my {b} is finally improving.","Stop overcomplicating it. {a} three times a week will fix your {b}.","PR day! {a} felt smooth thanks to working on {b}.","Myth: you need a gym for results. {a} at home built my {b}.","{n}-minute workout for busy days: {a}, no equipment, great for {b}.","Coaching tip: track {a} for two weeks before changing anything about your {b}.","Did my first {a} this morning. {b} training paid off.","Desi diet + {a} = the most sustainable way I’ve found to improve {b}."],"a":["strength training","a 5k run","yoga flows","kettlebell circuits","zone 2 cardio","a half marathon","mobility work","calisthenics","a high-protein meal plan","HIIT sessions"],"b":["posture","endurance","core strength","recovery","sleep quality","energy levels","flexibility","running pace"],"h":["#Fitness","#Workout","#HealthyLiving","#FitIndia","#Running","#Yoga"],"v":["Follow along: 30 seconds of {a}.","Form check: {a} done right.","My full {a} session, sped up.","Beginner guide to {a}."],"p":["12-week transformation programme for a nutrition brand: {a}.","Running challenge with a sportswear label built around {a}.","Gym chain launch campaign featuring {a} classes."],"bio":["Certified strength coach. Simple training that fits real Indian life. {city}.","Runner, yoga teacher and protein-powered home cook. Coaching from {city}."],"head":"Fitness coach & creator","skills":["Coaching","Workout videos","Nutrition"]},
"Travel":{"t":["{n} days in {a} and {b} was the highlight. Saving this for anyone planning a trip.","Underrated: {a}. Skip the crowds and go for {b}.","Budget breakdown for {a}: ₹{n},000 for five days including stays, food and {b}.","Woke up at 5 to catch {b} in {a}. Worth every minute.","Solo trip to {a}. Felt safe, met kind people, and {b} was unreal.","Best time to visit {a}? Go just after the monsoon for {b}.","Train journey to {a} beats flying. {b} through the window the whole way.","Hidden homestay in {a}: {n} rooms, home-cooked food, and {b} from the balcony."],"a":["Spiti Valley","Hampi","Meghalaya","Kerala’s backwaters","Pondicherry","Rishikesh","Ladakh","Coorg","Udaipur","the Andamans"],"b":["the sunrise","the street food","the night sky","a local market","the waterfalls","a houseboat stay","the trekking trails","the old town walks"],"h":["#Travel","#IncredibleIndia","#TravelGram","#SoloTravel","#Wanderlust","#BudgetTravel"],"v":["{a} in 45 seconds.","A morning in {a}, no music, just sounds.","Road trip to {a}: the highlights.","Is {a} worth the hype? Watch first."],"p":["Destination film for a state tourism board: {a}.","Hotel partnership series shot in {a} — 900k views.","Travel guide e-book and reels package for {a}."],"bio":["Slow traveller covering offbeat India on a budget. Currently between {city} and the mountains.","Travel filmmaker. 22 states and counting. Home base: {city}."],"head":"Travel creator","skills":["Travel films","Drone photography","Itineraries"]},
"Education":{"t":["Explaining {a} in {n} minutes so you never forget it. Perfect for {b}.","Preparing for {b}? Master {a} first. Everything else gets easier.","My note-taking system for {a}: one page, three colours, zero stress before {b}.","Free resource: {n} practice questions on {a}, made for {b}.","Most people learn {a} the hard way. Here’s the shortcut I teach for {b}.","Office hours today: bring your doubts on {a} — great prep for {b}.","Teaching {a} to {n} students this month taught me more than any textbook about {b}.","If {a} confuses you, start with real examples. That’s how {b} finally clicked for my class."],"a":["compound interest","Python basics","the French Revolution","calculus limits","SQL joins","organic chemistry reactions","public speaking","data structures","personal finance","English grammar tenses"],"b":["board exams","JEE","coding interviews","CAT prep","UPSC","your first job","college semesters","IELTS"],"h":["#Education","#StudyTips","#LearnOnInstagram","#EdTech","#Students","#Upskill"],"v":["{a} explained with one diagram.","60-second lesson: {a}.","Common mistakes in {a} and how to fix them.","Live class clip: {a}."],"p":["Course launch campaign for an edtech platform on {a}.","Explainer series on {a} — used in 300+ classrooms.","Workshop for a university club covering {a}."],"bio":["Teacher on the internet. Turning tough topics into 60-second lessons. {city}.","Making exams less scary. Study systems, notes and doubt sessions from {city}."],"head":"Educator & creator","skills":["Teaching","Explainers","Course creation"]},
"Business":{"t":["Lesson from {n} months of running my startup: {a} matters more than {b}.","Bootstrapped to ₹{n} lakh MRR. What worked: {a}. What didn’t: chasing {b}.","Founders, stop ignoring {a}. It quietly decides your {b}.","Hiring our first {n} people taught me that {a} beats perfect {b}.","The one thing I review every Monday: {a}. It predicts {b} better than anything.","We almost shut down last year. {a} saved us, and {b} came after.","Creator-led brands win because of {a}. Paid ads only amplify {b}.","Thread: how we built {a} with zero budget and still grew {b}."],"a":["customer retention","distribution","founder-led sales","a clear pricing page","community building","unit economics","weekly shipping","cash flow discipline","brand storytelling","partnerships with creators"],"b":["fundraising","growth","hiring","conversion","team morale","valuation","revenue","product-market fit"],"h":["#Business","#Startups","#Entrepreneurship","#Founders","#Marketing","#D2C"],"v":["My honest take on {a} in 60 seconds.","Founder diary: a week focused on {a}.","Whiteboard session: {a}.","What I’d do differently about {a}."],"p":["Brand strategy sprint for a D2C startup focused on {a}.","LinkedIn ghostwriting retainer on {a} — 4x follower growth.","Founder podcast series sponsored by a fintech, theme: {a}."],"bio":["Founder, operator and occasional angel. Writing about building brands in India. {city}.","Helping D2C founders grow with creators and community. Based in {city}."],"head":"Founder & business creator","skills":["Thought leadership","Copywriting","Podcasts"]},
"Beauty":{"t":["{n}-minute routine for {b}: cleanser, {a}, moisturiser, sunscreen. That’s it.","Honest review: {a} after {n} weeks. Great for {b}, not for sensitive days.","Dermat-approved tip: introduce {a} slowly if you’re dealing with {b}.","Budget dupe alert: {a} under ₹{n}00 that works for {b}.","Humid weather means {a} only. My {b} routine has never been easier.","Bridal trial today! {a} kept everything in place for {b}.","Stop buying everything. {a} alone made the biggest difference for {b}.","Makeup for {b} in under {n} minutes, starring {a}."],"a":["a niacinamide serum","a gel moisturiser","mineral sunscreen","a lip and cheek tint","a vitamin C serum","a ceramide cream","kajal","a hair oil blend","a clay mask","setting spray"],"b":["oily skin","acne-prone skin","festive makeup","dark spots","dry winter skin","an everyday glow","frizzy hair","long workdays"],"h":["#Beauty","#Skincare","#MakeupTutorial","#SkincareRoutine","#IndianBeauty","#GlowUp"],"v":["GRWM with {a}.","Before and after: two weeks of {a}.","How I apply {a} without pilling.","30-second {a} tutorial."],"p":["Product launch content for a clean-beauty brand: {a}.","Bridal makeup lookbook featuring {a}.","Skincare education series for a pharmacy chain on {a}."],"bio":["Skincare that respects your skin and your budget. Dermat-informed routines from {city}.","Makeup artist and educator. Bridal, festive and everyday glam in {city}."],"head":"Beauty & skincare creator","skills":["Makeup","Skincare reviews","Tutorials"]},
"Food":{"t":["Made {a} from scratch in {n} minutes. Perfect for {b}.","Grandma’s recipe for {a}, finally written down. Ideal for {b}.","Street food crawl: {a} was the clear winner. Best for {b}.","High-protein twist on {a} — great for {b}, still tastes like home.","Meal prep Sunday: {a} for the whole week, ready for {b}.","Rated {n} places for {a} in my city. The winner is perfect for {b}.","One-pot {a} for {b}. Fewer dishes, more flavour.","Tried a viral recipe for {a}. Verdict: great for {b} with one tweak."],"a":["paneer tikka","masala dosa","rajma chawal","millet khichdi","butter chicken","a mango cheesecake","pav bhaji","vegan biryani","chole kulche","filter coffee"],"b":["weeknight dinners","lunch boxes","festive gatherings","date night","rainy evenings","post-workout meals","house parties","Sunday brunch"],"h":["#Food","#IndianFood","#HomeCooking","#FoodBlogger","#StreetFood","#Recipes"],"v":["{a} in 45 seconds.","Cook with me: {a}.","The secret to perfect {a}.","Street-side {a}, start to finish."],"p":["Recipe video series for a cookware brand featuring {a}.","Restaurant launch content centred on {a} — 650k views.","Festive recipe e-book and reels for a spice brand: {a}."],"bio":["Home cook sharing family recipes and street food finds from {city}.","Chef turned creator. Quick, healthy Indian meals from my tiny kitchen in {city}."],"head":"Food creator","skills":["Recipe videos","Food photography","Restaurant reviews"]}
}$json$;
  camp jsonb := $json${
"Tech":{"head":"Consumer tech brand","word":"tech","titles":["Launch reviews for the {product}","Unboxing reels: {product}","30-day honest review of the {product}","Festive gifting guide featuring the {product}","Creator setup tours with the {product}","Tech explainer series: {product}"],"aud":["tech-savvy 18–34 year olds in metro cities","students and first-job professionals buying their first gadgets","remote workers upgrading their home office"],"del":[["1 YouTube review (8–12 min)","2 Instagram reels","3 stories with link"],["2 Instagram reels","1 carousel post","Unboxing story set"]],"elig":["Verified Qolabrate creator","10k+ followers in tech or gadgets","Based in India"],"skills":["Product reviews","Unboxing","Video editing"]},
"Fashion":{"head":"Fashion label","word":"fashion","titles":["Styling challenge: {product}","Festive lookbook for our {product}","Campus ambassadors for the {product}","Wedding season edit: {product}","Sustainable fashion stories with our {product}","Street style reels: {product}"],"aud":["style-conscious women 18–30 across India","college students in Tier 1 and Tier 2 cities","young professionals building a work wardrobe"],"del":[["3 Instagram reels","1 carousel lookbook","Story set with link"],["2 reels","5 styled photos","1 YouTube short"]],"elig":["Verified Qolabrate creator","15k+ followers in fashion or lifestyle","Comfortable on camera"],"skills":["Styling","Lookbooks","Reels"]},
"Beauty":{"head":"Beauty & skincare brand","word":"beauty","titles":["4-week skin journey with the {product}","GRWM reels featuring our {product}","Bridal season tutorials: {product}","Honest review campaign: {product}","Monsoon beauty routine with the {product}","Dermat-backed education series: {product}"],"aud":["skincare beginners aged 18–28","women 22–35 with oily or combination skin","brides-to-be and wedding guests"],"del":[["2 tutorial reels","1 before/after carousel","Stories over 4 weeks"],["1 YouTube review","2 reels","3 stories"]],"elig":["Verified Qolabrate creator","10k+ followers in beauty or skincare","No competing skincare deal in the last 60 days"],"skills":["Makeup","Skincare reviews","Tutorials"]},
"Food":{"head":"Food & beverage brand","word":"food","titles":["Recipe reels with our {product}","Weeknight dinner challenge: {product}","Festive feast content featuring {product}","Office lunch hacks with {product}","Taste test videos: {product}","Healthy snacking series: {product}"],"aud":["busy working couples in metro cities","health-conscious millennials","home cooks who love regional Indian food"],"del":[["2 recipe reels","1 carousel recipe card","3 stories"],["1 YouTube recipe video","2 shorts","Story set"]],"elig":["Verified Qolabrate creator","5k+ followers in food","Own kitchen setup for shoots"],"skills":["Recipe videos","Food photography","Restaurant reviews"]},
"Fitness":{"head":"Fitness brand","word":"fitness","titles":["30-day fitness challenge with the {product}","Run club ambassadors: {product}","Home workout series featuring the {product}","Marathon training diaries: {product}","Transformation stories with {product}","Yoga & mobility reels: {product}"],"aud":["beginners starting their fitness journey","runners training for their first 10k","working professionals who train at home"],"del":[["4 workout reels over 30 days","Weekly progress stories","1 recap post"],["2 reels","1 YouTube vlog","3 stories"]],"elig":["Verified Qolabrate creator","10k+ followers in fitness or wellness","Certified trainer preferred"],"skills":["Coaching","Workout videos","Nutrition"]},
"Education":{"head":"Learning platform","word":"learning","titles":["Student success stories: {product}","Explainer reels for our {product}","Exam season study-with-me: {product}","Career switch stories: {product}","Live doubt sessions for the {product}","Campus creator programme: {product}"],"aud":["JEE and NEET aspirants","college students preparing for placements","working professionals looking to upskill"],"del":[["2 explainer reels","1 YouTube video","Story set with link"],["3 shorts","1 live session","1 carousel"]],"elig":["Verified Qolabrate creator","Educator or student creator","Clear Hindi or English delivery"],"skills":["Teaching","Explainers","Course creation"]},
"Lifestyle":{"head":"Lifestyle brand","word":"lifestyle","titles":["Home makeover series with our {product}","Slow living stories featuring the {product}","Weekend getaway content: {product}","Morning routine reels with the {product}","Festive home edit: {product}","Self-care Sunday series: {product}"],"aud":["first-time renters setting up a home","millennials interested in mindful living","weekend travellers aged 25–40"],"del":[["2 reels","1 carousel","Story series"],["1 YouTube vlog","2 reels","5 photos"]],"elig":["Verified Qolabrate creator","8k+ followers in lifestyle or home","Based in a metro city"],"skills":["Photography","Reels","Storytelling"]}
}$json$;
  descs text[] := array[
    '{brand} is looking for creators to showcase the {product} to {audience}. We want honest, story-led content that shows real use over at least two weeks. We’ll ship the product, share a creative brief and give you room to make it your own.',
    'Join {brand} for a campaign around the {product}. The goal is to reach {audience} with relatable, high-quality content. Usage rights for 3 months on brand channels, paid in INR within 15 days of approval.',
    'We’re partnering with a small group of creators to introduce the {product}. Ideal partners speak to {audience} and care about authenticity. Brief, product and a dedicated brand contact provided.'];
  promos text[] := array[
    'Meet the {product} from {brand}. Designed with creators, tested for months, available today. Launch offer: {pct}% off this week.',
    '{brand} presents the {product}. Built for everyday {word} lovers. Tap the link in our bio to shop.',
    'New drop: the {product}. Limited first batch, made in India. — {brand}',
    'You asked, we listened. The {product} is back in stock with {pct}% off for the Qolabrate community. — {brand}',
    'Why we built the {product}: because {word} should be simple, honest and affordable. — {brand}',
    'Our festive edit is live. The {product} now ships across India in 48 hours. — {brand}'];
  sponsored text[] := array[
    'Proud to partner with {brand} on “{title}”. Been using the {product} for three weeks and it’s now part of my daily routine.',
    'Working with {brand} on “{title}”. Honest thoughts: the {product} nails the basics and the details are lovely.',
    'Behind the scenes from my shoot with {brand} for “{title}”. Swipe through for the final edit.',
    'Paid partnership with {brand}. “{title}” has been one of my favourite collaborations this year — the {product} made it easy.'];
  collabs text[] := array[
    'We’re hiring creators! {brand} is looking for {n} {word} creators for “{title}”. Budget {budget}. Apply on Qolabrate by {date}.',
    'Open collaboration: “{title}”. {n} spots for {word} creators, paid in INR, apply before {date}. Details on our campaign page.',
    'Calling all {word} creators — “{title}” is live on Qolabrate. Budget {budget}, {n} creators needed. Apply by {date}.',
    'Campaign alert from {brand}: “{title}”. We want authentic {word} storytellers. Budget {budget}. Applications close {date}.'];
  signoffs text[] := array['Full breakdown in the comments.','What would you add?','Save this for later.','More on this soon.','Tell me your take below.','Part two this weekend.','Questions welcome.','Who else has tried this?','Link in bio for details.','Would you try it?','Sharing what worked for me.','Let me know if this helps.'];
  comments_pool text[] := array['This is so useful, saving it!','Needed this today, thank you.','Love the honesty in this.','Can you do a part two?','Where did you get this? 😍','Tried it last week, totally agree.','Underrated advice right here.','The second point hit home.','Bookmarked for the weekend.','This deserves way more reach.','Okay, this convinced me.','How long did this take you?','Brilliant breakdown 👏','Sharing this with my team.','Would love a longer video on this.','Following for more like this!','You explain it so simply.','Respectfully disagree on one part, but great post.','Same experience here!','Any budget alternatives?','This made my day.','What camera do you use?','Finally someone said it.','Adding this to my list.','Super clean edit!','Such a vibe ✨','Can confirm, works like a charm.','Big fan of this series.','Mind sharing your setup?','Inspiring as always.','Didn’t know this, thanks!','The details here are 🔥','Is this available in Pune?','Saving this for my next trip.','Wow, the colours!','Totally trying this tomorrow.','Good reminder for all of us.','This is the content I’m here for.','Quality over quantity, love it.','Congrats on the collab!'];

  seed_now timestamptz := now();
  c_ids uuid[] := '{}'; c_cat text[] := '{}'; c_f int[] := '{}'; c_er numeric[] := '{}'; c_ver boolean[] := '{}';
  vc int[] := '{}';
  b_ids uuid[] := '{}'; b_f int[] := '{}'; b_er numeric[] := '{}';
  vb int[] := '{}';
  k_title text[] := '{}'; k_brand int[] := '{}'; k_cat text[] := '{}'; k_bmin int[] := '{}'; k_bmax int[] := '{}'; k_appdl date[] := '{}'; k_need int[] := '{}';
  i int; j int; k int; n int; m int; rc int; slot int; idx int;
  v_first text; v_last text; v_name text; v_user text; v_cat text; v_city text; v_f int; v_er numeric; v_ver boolean;
  v_id uuid; v_brand int; v_author int; v_author_id uuid; v_type text; v_body text; v_media jsonb; v_campaign uuid;
  v_likes int; v_time timestamptz; v_c jsonb; v_cp jsonb; v_tags text; v_h1 int; v_h2 int; v_stage text; v_status text;
  v_bmin int; v_bmax int; v_dl date; v_appdl date; v_pub timestamptz; v_title text; v_aud text; v_url text; v_budget text; v_commenter int;
  ins_profiles int := 0; ins_campaigns int := 0; ins_posts int := 0; ins_comments int := 0;
begin
  if auth.uid() is not null and not public.v2_has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can seed demo content.';
  end if;

  for i in 1..70 loop
    v_first := first_names[i];
    v_last := last_names[1 + (i * 7) % 30];
    v_name := v_first || ' ' || v_last;
    v_user := left(lower(v_first) || '_' || lower(v_last), 20);
    v_cat := cats[1 + (i - 1) % 11];
    v_city := cities[1 + (i * 5) % 16];
    v_f := (800 + public.demo_hash('cf' || i, 9200)) * (10 ^ public.demo_hash('cp' || i, 3))::int;
    v_er := round((1.5 + public.demo_hash('ce' || i, 80) / 10.0)::numeric, 2);
    v_ver := i % 5 <> 0;
    v_id := public.demo_uuid('creator', i);
    v_c := content -> v_cat;
    c_ids := c_ids || v_id; c_cat := c_cat || v_cat; c_f := c_f || v_f; c_er := c_er || v_er; c_ver := c_ver || v_ver;
    if v_ver then vc := vc || i; end if;

    perform set_config('qola.internal', 'on', true);
    insert into public.v2_profiles (id, username, display_name, account_type, headline, bio, location, verified, onboarded,
      followers_count, following_count, engagement_rate, is_demo, created_at, updated_at)
    values (v_id, v_user, v_name, 'creator', (v_c ->> 'head') || ' · ' || v_city,
      replace(v_c -> 'bio' ->> (i % 2), '{city}', v_city), v_city, v_ver, true,
      v_f, 60 + public.demo_hash('cg' || i, 900), v_er, true,
      seed_now - make_interval(days => 120 + public.demo_hash('cd' || i, 600)), seed_now)
    on conflict do nothing;
    get diagnostics rc = row_count;
    if rc > 0 then
      ins_profiles := ins_profiles + 1;
      insert into public.v2_creator_profiles (user_id, skills, categories, experience_level, collaboration_interests, availability, preferred_project_types)
      values (v_id, array(select jsonb_array_elements_text(v_c -> 'skills')), array[v_cat],
        case when v_f > 200000 then 'Expert' when v_f > 30000 then 'Established' else 'Emerging' end,
        array['Sponsored posts','Reels','Long-term ambassador'], 'Open to paid collaborations', array['one_off','ongoing'])
      on conflict do nothing;
    end if;
  end loop;

  for j in 1..30 loop
    v_name := brand_names[j];
    v_user := left(lower(regexp_replace(v_name, '[^A-Za-z0-9]', '', 'g')), 20);
    v_cat := brand_cats[j];
    v_cp := camp -> v_cat;
    v_city := cities[1 + (j * 3) % 16];
    v_f := (5000 + public.demo_hash('bf' || j, 95000)) * (1 + public.demo_hash('bp' || j, 6));
    v_er := round((0.8 + public.demo_hash('be' || j, 40) / 10.0)::numeric, 2);
    v_ver := j % 7 <> 0;
    v_id := public.demo_uuid('brand', j);
    b_ids := b_ids || v_id; b_f := b_f || v_f; b_er := b_er || v_er;
    if v_ver then vb := vb || j; end if;

    perform set_config('qola.internal', 'on', true);
    insert into public.v2_profiles (id, username, display_name, account_type, headline, bio, location, verified, onboarded,
      followers_count, following_count, engagement_rate, is_demo, created_at, updated_at)
    values (v_id, v_user, v_name, 'brand', (v_cp ->> 'head') || ' · ' || v_city,
      v_name || ' makes the ' || brand_products[j] || ' for modern India. We partner with creators who tell honest stories.',
      v_city, v_ver, true, v_f, 20 + public.demo_hash('bg' || j, 300), v_er, true,
      seed_now - make_interval(days => 200 + public.demo_hash('bd' || j, 700)), seed_now)
    on conflict do nothing;
    get diagnostics rc = row_count;
    if rc > 0 then
      ins_profiles := ins_profiles + 1;
      insert into public.v2_brand_profiles (user_id, industry, company_description, contact_person, campaign_categories, target_audience, collaboration_requirements)
      values (v_id, v_cat,
        v_name || ' is an Indian ' || (v_cp ->> 'word') || ' brand known for its ' || brand_products[j] || '.',
        first_names[1 + (j * 3) % 70] || ' ' || last_names[1 + (j * 11) % 30],
        array[v_cat], v_cp -> 'aud' ->> (j % 3), 'Verified creators with an engaged Indian audience.')
      on conflict do nothing;
    end if;
  end loop;

  for k in 1..100 loop
    v_brand := vb[1 + (k - 1) % array_length(vb, 1)];
    v_cat := brand_cats[v_brand];
    v_cp := camp -> v_cat;
    v_title := replace(v_cp -> 'titles' ->> (((k - 1) / array_length(vb, 1) + v_brand) % 6), '{product}', brand_products[v_brand]);
    v_aud := v_cp -> 'aud' ->> (k % 3);
    v_bmin := (15 + public.demo_hash('kb' || k, 60)) * 1000;
    v_bmax := ((v_bmin * (2 + public.demo_hash('kx' || k, 4))) / 5000) * 5000;
    if k <= 60 then
      v_stage := 'open'; v_status := 'published';
      v_appdl := current_date + 5 + public.demo_hash('ka' || k, 25);
      v_dl := v_appdl + 14 + public.demo_hash('kd' || k, 30);
      v_pub := seed_now - make_interval(days => public.demo_hash('kp' || k, 20), hours => public.demo_hash('kh' || k, 20));
    elsif k <= 85 then
      v_stage := 'in_progress'; v_status := 'closed';
      v_appdl := current_date - (3 + public.demo_hash('ka' || k, 20));
      v_dl := current_date + 3 + public.demo_hash('kd' || k, 30);
      v_pub := seed_now - make_interval(days => 25 + public.demo_hash('kp' || k, 30));
    else
      v_stage := 'completed'; v_status := 'closed';
      v_dl := current_date - (5 + public.demo_hash('kd' || k, 80));
      v_appdl := v_dl - 21;
      v_pub := seed_now - make_interval(days => 60 + public.demo_hash('kp' || k, 90));
    end if;
    k_title := k_title || v_title; k_brand := k_brand || v_brand; k_cat := k_cat || v_cat;
    k_bmin := k_bmin || v_bmin; k_bmax := k_bmax || v_bmax; k_appdl := k_appdl || v_appdl;
    k_need := k_need || (1 + public.demo_hash('kn' || k, 12));

    perform set_config('qola.internal', 'on', true);
    insert into public.v2_campaigns (id, brand_id, title, description, category, skills, deliverables, compensation_type,
      budget_min, budget_max, currency, project_type, deadline, application_deadline, creators_needed, remote, location,
      status, applications_count, published_at, created_at, is_demo, target_audience, eligibility, stage)
    values (public.demo_uuid('campaign', k), b_ids[v_brand], v_title,
      replace(replace(replace(descs[1 + k % 3], '{brand}', brand_names[v_brand]), '{product}', brand_products[v_brand]), '{audience}', v_aud),
      v_cat, array(select jsonb_array_elements_text(v_cp -> 'skills')),
      array(select jsonb_array_elements_text(v_cp -> 'del' -> (k % 2))), 'paid',
      v_bmin, v_bmax, 'INR', (array['one_off','ongoing','ambassador','event'])[1 + k % 4], v_dl, v_appdl, k_need[k],
      k % 4 <> 0, case when k % 4 = 0 then cities[1 + k % 16] end,
      v_status, case when k <= 60 then 4 + public.demo_hash('kc' || k, 120) else 30 + public.demo_hash('kc' || k, 260) end,
      v_pub, v_pub - interval '2 days', true, v_aud,
      array(select jsonb_array_elements_text(v_cp -> 'elig')), v_stage)
    on conflict do nothing;
    get diagnostics rc = row_count;
    ins_campaigns := ins_campaigns + rc;
  end loop;

  for n in 1..1000 loop
    slot := n % 20;
    v_campaign := null;
    v_media := '[]'::jsonb;
    v_type := case when slot <= 6 then 'post' when slot in (7,8,9,10,11,12,19) then 'image' when slot in (13,14) then 'video'
      when slot = 15 then 'portfolio' when slot = 16 then 'promotion' when slot = 17 then 'sponsored' else 'collab' end;
    v_h1 := n % 6;
    v_h2 := (v_h1 + 1 + (n / 6) % 5) % 6;

    if v_type = 'promotion' then
      v_brand := vb[1 + public.demo_hash('pb' || n, array_length(vb, 1))];
      v_cat := brand_cats[v_brand];
      v_author_id := b_ids[v_brand]; v_f := b_f[v_brand]; v_er := b_er[v_brand];
      v_body := replace(replace(replace(replace(promos[1 + (n / 20) % 6], '{brand}', brand_names[v_brand]), '{product}', brand_products[v_brand]),
        '{pct}', (10 + 5 * (n % 5))::text), '{word}', camp -> v_cat ->> 'word');
    elsif v_type = 'collab' then
      k := 1 + public.demo_hash('co' || n, 60);
      v_brand := k_brand[k]; v_cat := k_cat[k];
      v_author_id := b_ids[v_brand]; v_f := b_f[v_brand]; v_er := b_er[v_brand];
      v_campaign := public.demo_uuid('campaign', k);
      v_budget := '₹' || case when k_bmin[k] >= 100000 then round(k_bmin[k] / 100000.0, 1) || ' lakh' else (k_bmin[k] / 1000) || 'k' end
        || '–₹' || case when k_bmax[k] >= 100000 then round(k_bmax[k] / 100000.0, 1) || ' lakh' else (k_bmax[k] / 1000) || 'k' end;
      v_body := replace(replace(replace(replace(replace(replace(collabs[1 + (n / 20) % 4], '{brand}', brand_names[v_brand]), '{title}', k_title[k]),
        '{n}', k_need[k]::text), '{word}', camp -> v_cat ->> 'word'), '{budget}', v_budget), '{date}', to_char(k_appdl[k], 'FMDD Mon'));
    elsif v_type = 'sponsored' then
      k := 61 + public.demo_hash('sp' || n, 40);
      v_brand := k_brand[k]; v_cat := k_cat[k];
      v_author := vc[1 + public.demo_hash('sa' || n, array_length(vc, 1))];
      v_author_id := c_ids[v_author]; v_f := c_f[v_author]; v_er := c_er[v_author];
      v_campaign := public.demo_uuid('campaign', k);
      v_body := replace(replace(replace(sponsored[1 + (n / 20) % 4], '{brand}', brand_names[v_brand]), '{title}', k_title[k]), '{product}', brand_products[v_brand]);
    else
      v_author := vc[1 + public.demo_hash('a' || n, array_length(vc, 1))];
      v_author_id := c_ids[v_author]; v_f := c_f[v_author]; v_er := c_er[v_author];
      v_cat := case when public.demo_hash('c' || n, 5) = 0 then cats[1 + public.demo_hash('cc' || n, 11)] else c_cat[v_author] end;
      v_c := content -> v_cat;
      if v_type = 'video' then
        v_body := replace(v_c -> 'v' ->> ((n / 20) % 4), '{a}', v_c -> 'a' ->> ((n / 8) % 10)) || ' ' || signoffs[1 + n % 12];
      elsif v_type = 'portfolio' then
        v_body := 'New in my portfolio: ' || replace(v_c -> 'p' ->> ((n / 20) % 3), '{a}', v_c -> 'a' ->> ((n / 8) % 10)) || ' ' || signoffs[1 + n % 12];
      else
        v_body := replace(replace(replace(v_c -> 't' ->> (n % 8), '{a}', v_c -> 'a' ->> ((n / 8) % 10)),
          '{b}', v_c -> 'b' ->> ((n / 80 + n / 640) % 8)), '{n}', (3 + (n * 7) % 40)::text);
      end if;
    end if;

    v_c := content -> v_cat;
    v_tags := (v_c -> 'h' ->> v_h1) || ' ' || (v_c -> 'h' ->> v_h2);
    if v_type = 'sponsored' then v_tags := '#ad #Sponsored ' || v_tags;
    elsif v_type = 'collab' then v_tags := '#CreatorCollab #Hiring ' || v_tags; end if;
    v_body := upper(left(v_body, 1)) || substr(v_body, 2) || E'\n\n' || v_tags;

    v_url := img -> lower(v_cat) ->> (n % 2);
    if v_type in ('image','portfolio','promotion','sponsored') then
      v_media := jsonb_build_array(jsonb_build_object('url', v_url, 'path', 'demo/' || lower(v_cat) || '-' || (n % 2 + 1) || '.jpg', 'type', 'image'));
    elsif v_type = 'video' then
      v_media := jsonb_build_array(jsonb_build_object('url', v_url, 'path', 'demo/video-' || n, 'type', 'image',
        'placeholder', 'video', 'duration', '0:' || lpad((15 + n % 45)::text, 2, '0')));
    end if;

    v_likes := least(250000, greatest(4, (v_f * v_er / 100.0 * (25 + public.demo_hash('l' || n, 150)) / 100.0)::int));
    v_time := seed_now - make_interval(mins => n * 61 + public.demo_hash('t' || n, 55));
    v_id := public.demo_uuid('post', n);

    perform set_config('qola.internal', 'on', true);
    insert into public.posts (id, author_id, body, media, visibility, like_count, repost_count, created_at, is_demo, category, post_type, campaign_id)
    values (v_id, v_author_id, left(v_body, 1000), v_media, 'public', v_likes, (v_likes * (1 + public.demo_hash('r' || n, 8)) / 100),
      v_time, true, v_cat, v_type, v_campaign)
    on conflict (id) do nothing;
    get diagnostics rc = row_count;
    if rc > 0 then
      ins_posts := ins_posts + 1;
      m := public.demo_hash('cm' || n, 6);
      for j in 1..m loop
        idx := 1 + public.demo_hash('ca' || n || '-' || j, 70);
        if c_ids[idx] = v_author_id then idx := 1 + idx % 70; end if;
        perform set_config('qola.internal', 'on', true);
        insert into public.comments (id, post_id, author_id, body, created_at)
        values (public.demo_uuid('comment', n * 10 + j), v_id, c_ids[idx], comments_pool[1 + public.demo_hash('cb' || n || '-' || j, 40)],
          least(v_time + make_interval(mins => j * 23 + public.demo_hash('ct' || n || '-' || j, 300)), seed_now - interval '1 minute'))
        on conflict (id) do nothing;
        get diagnostics rc = row_count;
        ins_comments := ins_comments + rc;
      end loop;
    end if;
  end loop;

  perform set_config('qola.internal', 'off', true);
  return jsonb_build_object('profiles', ins_profiles, 'campaigns', ins_campaigns, 'posts', ins_posts, 'comments', ins_comments);
end $$;
revoke execute on function public.seed_demo_content() from public, anon;
grant execute on function public.seed_demo_content() to authenticated;

create or replace function public.clear_demo_content()
returns jsonb language plpgsql security definer set search_path = public as $$
declare p int; c int; u int;
begin
  if auth.uid() is not null and not public.v2_has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can remove demo content.';
  end if;
  delete from public.posts where is_demo; get diagnostics p = row_count;
  delete from public.v2_campaigns where is_demo; get diagnostics c = row_count;
  delete from public.v2_profiles where is_demo; get diagnostics u = row_count;
  return jsonb_build_object('posts', p, 'campaigns', c, 'profiles', u);
end $$;
revoke execute on function public.clear_demo_content() from public, anon;
grant execute on function public.clear_demo_content() to authenticated;