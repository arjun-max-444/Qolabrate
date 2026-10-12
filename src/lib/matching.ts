// Creator <-> brand scoring: niche 50, platforms 15, follower fit 15, engagement 10, location 5, language 5.
export type Creator = { id: string; name: string; handle?: string | null; niches: string[]; platforms: string[]; followers: number; engagement_rate: number; location: string; languages: string[]; bio?: string | null; avatar_url?: string | null; is_demo?: boolean; user_id?: string | null };
export type Brand = { id: string; name: string; niches: string[]; platforms: string[]; min_followers: number; max_followers: number; budget?: number | null; location: string; languages: string[]; bio?: string | null; avatar_url?: string | null; is_demo?: boolean; user_id?: string | null };

const lc = (a: string[] = []) => a.map((x) => x.toLowerCase());
const overlap = (a: string[] = [], b: string[] = []) => {
  const s = new Set(lc(b));
  const hit = lc(a).filter((x) => s.has(x)).length;
  const union = new Set([...lc(a), ...lc(b)]).size || 1;
  return hit / union;
};

export function matchScore(c: Creator, b: Brand) {
  const niche = Math.min(50, overlap(c.niches, b.niches) * 40 + (c.niches[0] && c.niches[0].toLowerCase() === b.niches[0]?.toLowerCase() ? 10 : 0));
  const platform = overlap(c.platforms, b.platforms) * 15;
  const inRange = c.followers >= b.min_followers && c.followers <= b.max_followers;
  const edge = c.followers < b.min_followers ? b.min_followers : b.max_followers;
  const size = inRange ? 15 : Math.max(0, 15 - 15 * Math.abs(Math.log10((c.followers + 1) / Math.max(edge, 1))));
  const eng = Math.min(Number(c.engagement_rate) / 8, 1) * 10;
  const loc = c.location && c.location.toLowerCase() === b.location?.toLowerCase() ? 5 : 0;
  const lang = overlap(c.languages, b.languages) > 0 ? 5 : 0;
  return Math.round(Math.min(100, niche + platform + size + eng + loc + lang));
}

export function reasons(c: Creator, b: Brand) {
  const r: string[] = [];
  const bn = new Set(lc(b.niches));
  const bp = new Set(lc(b.platforms));
  const n = c.niches.filter((x) => bn.has(x.toLowerCase()));
  if (n.length) r.push(`Same niche: ${n.join(", ")}`);
  const p = c.platforms.filter((x) => bp.has(x.toLowerCase()));
  if (p.length) r.push(`Shared platforms: ${p.join(", ")}`);
  if (c.followers >= b.min_followers && c.followers <= b.max_followers) r.push("Audience size fits");
  if (c.location && c.location.toLowerCase() === b.location?.toLowerCase()) r.push(`Both in ${c.location}`);
  return r;
}

export function suggestBrandsForCreator(c: Creator, brands: Brand[], limit = 8) {
  return brands
    .filter((b) => !c.user_id || b.user_id !== c.user_id)
    .map((b) => ({ brand: b, score: matchScore(c, b), reasons: reasons(c, b) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
export function suggestCreatorsForBrand(b: Brand, creators: Creator[], limit = 8) {
  return creators
    .filter((c) => !b.user_id || c.user_id !== b.user_id)
    .map((c) => ({ creator: c, score: matchScore(c, b), reasons: reasons(c, b) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const NICHES = ["Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech", "Gaming", "Lifestyle", "Education", "Finance", "Music", "Parenting"];
export const PLATFORMS = ["Instagram", "YouTube", "TikTok", "X", "LinkedIn"];
export const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali"];
