import aria from "@/assets/ai-aria.jpg";
import kai from "@/assets/ai-kai.jpg";
import maya from "@/assets/ai-maya.jpg";
import dev from "@/assets/ai-dev.jpg";
import zoya from "@/assets/ai-zoya.jpg";
import luna from "@/assets/ai-luna.jpg";
import rex from "@/assets/ai-rex.jpg";
import nora from "@/assets/ai-nora.jpg";
import film from "@/assets/feed-film.jpg";
import campaign from "@/assets/feed-campaign.jpg";
import product from "@/assets/feed-product.jpg";

export const AI_CATEGORIES = ["Beauty", "Fashion", "Fitness", "Technology", "Food", "Travel", "Gaming", "Lifestyle"] as const;
export type AiCategory = (typeof AI_CATEGORIES)[number];
export const AI_FORMATS = ["Images", "Short videos", "Product photography", "Captions", "Scripts"] as const;
export type AiFormat = (typeof AI_FORMATS)[number];

export type AiPackage = { name: string; price: number; deliverables: string[]; days: number };
export type AiCreator = {
  id: string; name: string; username: string; image: string; bio: string; personality: string;
  category: AiCategory; tags: string[]; audience: string; location: string;
  estFollowers: number; estEngagement: number; formats: AiFormat[]; languages: string[];
  available: boolean; restrictions: string; portfolio: string[]; packages: AiPackage[];
};

const pk = (base: number, video: boolean): AiPackage[] => [
  { name: "Starter", price: base, deliverables: ["3 images", "3 captions"], days: 3 },
  { name: "Campaign", price: base * 2.4, deliverables: ["6 images", "6 captions", "1 script"], days: 5 },
  video
    ? { name: "Reel", price: base * 4, deliverables: ["2 vertical videos (8s)", "4 images", "captions"], days: 7 }
    : { name: "Premium", price: base * 3.5, deliverables: ["10 images", "10 captions", "product shots"], days: 7 },
];
const vid: AiFormat[] = ["Images", "Short videos", "Captions", "Scripts"];

export const aiCreators: AiCreator[] = [
  { id: "aria", name: "Aria", username: "aria.glow", image: aria, bio: "Skincare rituals and everyday glam, explained simply.", personality: "Warm, honest, routine-focused", category: "Beauty", tags: ["skincare", "makeup", "self-care"], audience: "Women 18–30", location: "India", estFollowers: 182000, estEngagement: 5.8, formats: vid, languages: ["English", "Hindi"], available: true, restrictions: "No medical or prescription claims.", portfolio: [aria, campaign, product], packages: pk(5000, true) },
  { id: "kai", name: "Kai", username: "kai.tech", image: kai, bio: "Gadgets, apps and honest first impressions.", personality: "Curious, direct, a little nerdy", category: "Technology", tags: ["gadgets", "apps", "reviews"], audience: "Men 18–34", location: "Global", estFollowers: 240000, estEngagement: 4.1, formats: vid, languages: ["English"], available: true, restrictions: "No financial or crypto promotions.", portfolio: [kai, film, product], packages: pk(7000, true) },
  { id: "maya", name: "Maya", username: "maya.moves", image: maya, bio: "Sunrise workouts and realistic fitness goals.", personality: "Energetic, encouraging", category: "Fitness", tags: ["workouts", "wellness", "sportswear"], audience: "Adults 20–40", location: "Global", estFollowers: 156000, estEngagement: 6.4, formats: vid, languages: ["English", "Spanish"], available: true, restrictions: "No weight-loss guarantees or supplements.", portfolio: [maya, film, product], packages: pk(6000, true) },
  { id: "dev", name: "Dev", username: "dev.plays", image: dev, bio: "Game drops, setups and late-night ranked sessions.", personality: "Funny, hype, community-first", category: "Gaming", tags: ["esports", "setups", "mobile games"], audience: "Teens & 18–28", location: "India", estFollowers: 310000, estEngagement: 7.2, formats: vid, languages: ["English", "Hindi"], available: false, restrictions: "No gambling or betting brands.", portfolio: [dev, product, film], packages: pk(6500, true) },
  { id: "zoya", name: "Zoya", username: "zoya.edit", image: zoya, bio: "Bold colour, sharp tailoring and festive edits.", personality: "Confident, editorial", category: "Fashion", tags: ["festive", "editorial", "accessories"], audience: "Women 22–38", location: "India", estFollowers: 205000, estEngagement: 4.9, formats: ["Images", "Product photography", "Captions"], languages: ["English", "Hindi"], available: true, restrictions: "Images only — no video.", portfolio: [zoya, campaign, product], packages: pk(8000, false) },
  { id: "luna", name: "Luna", username: "luna.wanders", image: luna, bio: "Slow travel, hidden beaches and packing lists.", personality: "Dreamy, calm, detailed", category: "Travel", tags: ["beaches", "hotels", "itineraries"], audience: "Adults 24–40", location: "Global", estFollowers: 128000, estEngagement: 5.3, formats: ["Images", "Captions", "Product photography"], languages: ["English", "French"], available: true, restrictions: "Images only — no video.", portfolio: [luna, campaign, film], packages: pk(5500, false) },
  { id: "rex", name: "Rex", username: "rex.cooks", image: rex, bio: "Big flavours, quick recipes, happy kitchens.", personality: "Jolly, generous, practical", category: "Food", tags: ["recipes", "kitchenware", "restaurants"], audience: "Families & 25–45", location: "Global", estFollowers: 174000, estEngagement: 6.0, formats: vid, languages: ["English"], available: true, restrictions: "No alcohol brands.", portfolio: [rex, product, campaign], packages: pk(5000, true) },
  { id: "nora", name: "Nora", username: "nora.home", image: nora, bio: "Plants, cosy corners and calm home routines.", personality: "Gentle, thoughtful", category: "Lifestyle", tags: ["home decor", "plants", "routines"], audience: "Adults 28–50", location: "Europe", estFollowers: 98000, estEngagement: 5.1, formats: vid, languages: ["English", "German"], available: true, restrictions: "No political content.", portfolio: [nora, campaign, film], packages: pk(4500, true) },
];

export const startingPrice = (c: AiCreator) => Math.min(...c.packages.map((p) => p.price));

export type AiFilters = { q: string; category: string; format: string; maxPrice: number; sort: "relevance" | "engagement" | "popularity" | "price" };
export const defaultFilters: AiFilters = { q: "", category: "", format: "", maxPrice: 0, sort: "relevance" };

export function filterAiCreators(list: AiCreator[], f: AiFilters): AiCreator[] {
  const q = f.q.trim().toLowerCase();
  const out = list.filter((c) =>
    (!q || [c.name, c.username, c.bio, c.category, ...c.tags].join(" ").toLowerCase().includes(q)) &&
    (!f.category || c.category === f.category) &&
    (!f.format || c.formats.includes(f.format as AiFormat)) &&
    (!f.maxPrice || startingPrice(c) <= f.maxPrice),
  );
  if (f.sort === "engagement") out.sort((a, b) => b.estEngagement - a.estEngagement);
  if (f.sort === "popularity") out.sort((a, b) => b.estFollowers - a.estFollowers);
  if (f.sort === "price") out.sort((a, b) => startingPrice(a) - startingPrice(b));
  return out;
}

export const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
export const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact" }).format(n);
