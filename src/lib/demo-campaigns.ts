/** Fictional sample campaigns shown alongside real ones so the board never looks empty. */
export type DemoCampaign = { id: string; brand: string; title: string; category: string; platforms: string[]; budget_min: number; budget_max: number; deadline: string; description: string };

export const demoCampaigns: DemoCampaign[] = [
  { id: "d1", brand: "Lumen Skincare", title: "Glow routine reels for monsoon launch", category: "Beauty", platforms: ["instagram"], budget_min: 15000, budget_max: 40000, deadline: "2026-11-20", description: "3 reels showing a morning routine with our new SPF serum." },
  { id: "d2", brand: "Trailhead Gear", title: "Weekend trek vlog", category: "Travel", platforms: ["youtube"], budget_min: 30000, budget_max: 80000, deadline: "2026-12-05", description: "One 8–12 minute vlog using our backpack range on a Himalayan trail." },
  { id: "d3", brand: "ByteBank", title: "Explain UPI savings in 60 seconds", category: "Finance", platforms: ["instagram", "youtube"], budget_min: 20000, budget_max: 50000, deadline: "2026-11-30", description: "Short explainers on our round-up savings feature." },
  { id: "d4", brand: "Masala Box", title: "Festive recipe series", category: "Food", platforms: ["instagram"], budget_min: 10000, budget_max: 25000, deadline: "2026-11-12", description: "Four quick recipes using our spice kits, festive styling." },
  { id: "d5", brand: "PixelForge", title: "Mobile game first-look stream", category: "Gaming", platforms: ["youtube"], budget_min: 25000, budget_max: 60000, deadline: "2026-12-15", description: "A 30-minute first-play video with an honest review." },
  { id: "d6", brand: "Kora Threads", title: "Winter lookbook try-on", category: "Fashion", platforms: ["instagram"], budget_min: 18000, budget_max: 45000, deadline: "2026-11-25", description: "Carousel + reel styling 5 looks from the winter drop." },
  { id: "d7", brand: "FitNest", title: "21-day home workout challenge", category: "Fitness", platforms: ["instagram", "youtube"], budget_min: 35000, budget_max: 90000, deadline: "2026-12-20", description: "Weekly check-in videos following our app's challenge." },
  { id: "d8", brand: "Nimbus Audio", title: "Earbuds unboxing and review", category: "Tech", platforms: ["youtube"], budget_min: 20000, budget_max: 55000, deadline: "2026-11-28", description: "Unboxing, sound test and a 2-week verdict." },
  { id: "d9", brand: "Little Sprouts", title: "Parent hacks with our snack range", category: "Lifestyle", platforms: ["instagram"], budget_min: 8000, budget_max: 20000, deadline: "2026-12-01", description: "Relatable reels for busy parents featuring our snacks." },
  { id: "d10", brand: "Stayscape", title: "Boutique stay room tours", category: "Travel", platforms: ["instagram", "youtube"], budget_min: 40000, budget_max: 100000, deadline: "2027-01-10", description: "Cinematic tours of three partner properties in Goa." },
];
