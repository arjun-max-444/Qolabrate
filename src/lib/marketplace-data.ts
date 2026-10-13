import type { Brief, Creator, MatchResult } from './marketplace-types'

import filmStudio from "@/assets/film-studio.jpg.asset.json";
import filmCrew from "@/assets/film-crew.jpg.asset.json";
import motion from "@/assets/motion-studio.jpg.asset.json";
import product from "@/assets/product-studio.jpg.asset.json";
import light from "@/assets/studio-light.jpg.asset.json";
import fashion from "@/assets/fashion-editorial.jpg.asset.json";
import vertical from "@/assets/vertical-video.jpg.asset.json";
import editing from "@/assets/editing-timeline.jpg.asset.json";
const images: Record<string,string> = {"film-studio.jpg":filmStudio.url,"film-crew.jpg":filmCrew.url,"motion-studio.jpg":motion.url,"product-studio.jpg":product.url,"studio-light.jpg":light.url,"fashion-editorial.jpg":fashion.url,"vertical-video.jpg":vertical.url,"editing-timeline.jpg":editing.url};
const asset = (name:string) => images[name] || product.url;

export const creators: Creator[] = [
  {
    id: 'mara-vel', name: 'Mara Velasquez', initials: 'MV', specialty: 'AI filmmaker', location: 'Mexico City · UTC−6',
    bio: 'Cinematic director building tactile worlds for product launches, fashion films, and social-first campaigns.', accent: '#c6785e',
    skills: ['Cinematic direction', 'Product storytelling', 'Vertical edit'], tools: ['Runway Gen-4', 'Kling 2.1', 'DaVinci Resolve'], formats: ['Video', 'Campaign'], rate: 3200, availability: 'Available this month', commercialUse: 'Paid + organic · worldwide',
    work: [{ id: 'mv-01', title: 'After the last light', category: 'Automotive launch', image: asset('film-studio.jpg'), description: 'A dusk-to-dawn film built from practical light studies and generative motion plates.', contentType: 'Video', aspectRatio: '9:16', duration: '20 sec', tools: ['Runway Gen-4', 'Kling 2.1'], workflow: ['Reference board', 'Motion tests', 'Edit + grade'], role: 'Director · editor', licensing: 'Commercial use discussed per brief' }, { id: 'mv-02', title: 'Chrome / soft', category: 'Beauty product', image: asset('film-crew.jpg'), description: 'A close-up product study balancing liquid surfaces with hard chrome geometry.', contentType: 'Video', aspectRatio: '4:5', duration: '12 sec', tools: ['Runway Gen-4', 'Photoshop'], workflow: ['Material study', 'Prompt passes', 'Retouch'], role: 'Director · compositor', licensing: 'Paid social and web included' }]
  },
  {
    id: 'luca-ori', name: 'Luca Oriz', initials: 'LO', specialty: 'AI animator', location: 'Barcelona · UTC+1',
    bio: 'Animator and motion designer translating brand systems into precise, playful worlds with a hand-built feel.', accent: '#7793a4',
    skills: ['2D/3D animation', 'Character motion', 'Explainer systems'], tools: ['Sora', 'Blender', 'After Effects'], formats: ['Animation', 'Video'], rate: 2400, availability: '2 week lead time', commercialUse: 'Organic + web · Europe',
    work: [{ id: 'lo-01', title: 'Soft machinery', category: 'Product animation', image: asset('motion-studio.jpg'), description: 'A miniature machine language for a new tool brand: soft edges, exact timing.', contentType: 'Animation', aspectRatio: '16:9', duration: '30 sec', tools: ['Blender', 'After Effects'], workflow: ['Styleframes', 'Rig test', 'Animation'], role: 'Animator', licensing: 'Organic, web and events' }]
  },
  {
    id: 'nia-kai', name: 'Nia Kato', initials: 'NK', specialty: 'Product advertising', location: 'Tokyo · UTC+9',
    bio: 'Product image-maker focused on clean surfaces, unusual scale, and campaign systems that can stretch.', accent: '#c9d43a',
    skills: ['Product stills', 'Art direction', 'Campaign systems'], tools: ['Midjourney V7', 'Flux Pro', 'Photoshop'], formats: ['Image', 'Campaign'], rate: 1800, availability: 'Available next week', commercialUse: 'Paid + organic · worldwide',
    work: [{ id: 'nk-01', title: 'Glass objects / 03', category: 'Homeware campaign', image: asset('product-studio.jpg'), description: 'A modular still-life system designed for product pages, paid social, and launch OOH.', contentType: 'Image', aspectRatio: '4:5', tools: ['Midjourney V7', 'Flux Pro'], workflow: ['Shot list', 'Material prompts', 'Color pass'], role: 'Art director · image maker', licensing: 'Usage terms documented per deliverable' }]
  },
  {
    id: 'omar-reed', name: 'Omar Reed', initials: 'OR', specialty: 'Generative artist', location: 'London · UTC+0',
    bio: 'Generative artist exploring culture, pattern, and the boundary between digital image and physical artifact.', accent: '#aeb0a7',
    skills: ['Visual worlds', 'Texture systems', 'Art direction'], tools: ['ComfyUI', 'Flux Pro', 'TouchDesigner'], formats: ['Image', 'Campaign'], rate: 1500, availability: 'Limited in June', commercialUse: 'Organic + editorial · worldwide',
    work: [{ id: 'or-01', title: 'Field notes 07', category: 'Editorial identity', image: asset('studio-light.jpg'), description: 'A weather system rendered as a collection of archival textures and moving light.', contentType: 'Image', aspectRatio: '1:1', tools: ['ComfyUI', 'Flux Pro'], workflow: ['Texture research', 'Node build', 'Output set'], role: 'Artist', licensing: 'Editorial and organic use only' }]
  },
  {
    id: 'sana-park', name: 'Sana Park', initials: 'SP', specialty: 'AI fashion', location: 'Seoul · UTC+9',
    bio: 'Fashion image director shaping synthetic garments, editorial portraits, and launch worlds with a crisp point of view.', accent: '#c6785e',
    skills: ['Fashion image', 'Synthetic garment', 'Editorial portrait'], tools: ['Midjourney V7', 'Magnific', 'Photoshop'], formats: ['Image', 'Campaign'], rate: 2900, availability: 'Available in 3 weeks', commercialUse: 'Paid + organic · worldwide',
    work: [{ id: 'sp-01', title: 'Cut on the bias', category: 'Fashion editorial', image: asset('fashion-editorial.jpg'), description: 'A lookbook that treats the garment as architecture and the body as a moving crop.', contentType: 'Image', aspectRatio: '4:5', tools: ['Midjourney V7', 'Magnific'], workflow: ['Silhouette studies', 'Editorial pass', 'Upscale + retouch'], role: 'Image director', licensing: 'Commercial terms subject to brand review' }]
  },
  {
    id: 'jon-bell', name: 'Jon Bell', initials: 'JB', specialty: 'Social video producer', location: 'New York · UTC−5',
    bio: 'Fast, strategic social producer creating cut-through in the first two seconds without sacrificing craft.', accent: '#7793a4',
    skills: ['Social hooks', 'UGC systems', 'Fast turnaround'], tools: ['Kling 2.1', 'CapCut', 'ElevenLabs'], formats: ['Video', 'Campaign'], rate: 1100, availability: 'Available now', commercialUse: 'Paid social · North America',
    work: [{ id: 'jb-01', title: 'One more scroll', category: 'Social launch pack', image: asset('vertical-video.jpg'), description: 'A six-cut social system for a lifestyle label built around a single visual hook.', contentType: 'Video', aspectRatio: '9:16', duration: '15 sec', tools: ['Kling 2.1', 'CapCut'], workflow: ['Hook matrix', 'Batch generation', 'Platform cutdowns'], role: 'Producer · editor', licensing: 'Paid social for 90 days' }]
  },
  {
    id: 'ayla-nova', name: 'Ayla Nova', initials: 'AN', specialty: 'AI filmmaker', location: 'Lisbon · UTC+0',
    bio: 'Director working between documentary rhythm and speculative fiction for brand films with a human pulse.', accent: '#c9d43a',
    skills: ['Brand film', 'Documentary rhythm', 'Sound-led edit'], tools: ['Sora', 'Runway Gen-4', 'Premiere'], formats: ['Video', 'Campaign'], rate: 4100, availability: '4 week lead time', commercialUse: 'Paid + organic · worldwide',
    work: [{ id: 'an-01', title: 'The room remembers', category: 'Hospitality film', image: asset('film-crew.jpg'), description: 'An atmospheric room study built as a short film rather than a property tour.', contentType: 'Video', aspectRatio: '16:9', duration: '45 sec', tools: ['Sora', 'Runway Gen-4'], workflow: ['Script treatment', 'Scene tests', 'Edit + sound'], role: 'Director', licensing: 'Paid use subject to territory' }]
  },
  {
    id: 'theo-miles', name: 'Theo Miles', initials: 'TM', specialty: 'Product advertising', location: 'Melbourne · UTC+10',
    bio: 'Still-life specialist with a taste for bold color, odd materials, and an unreasonably good crop.', accent: '#c6785e',
    skills: ['Still life', 'Launch kits', 'Color direction'], tools: ['Flux Pro', 'Photoshop', 'Blender'], formats: ['Image', 'Campaign'], rate: 2100, availability: 'Available this month', commercialUse: 'Paid + organic · worldwide',
    work: [{ id: 'tm-01', title: 'Heavy / light', category: 'Product launch', image: asset('product-studio.jpg'), description: 'A modular image family for a lightweight object that wanted to feel substantial.', contentType: 'Image', aspectRatio: '4:5', tools: ['Flux Pro', 'Blender'], workflow: ['Object study', 'Light tests', 'Export set'], role: 'Art director', licensing: 'Commercial use discussed per brief' }]
  },
  {
    id: 'mika-stone', name: 'Mika Stone', initials: 'MS', specialty: 'AI animation', location: 'Vancouver · UTC−8',
    bio: 'Motion designer making systems feel alive: identity toolkits, animated type, and playful product explainers.', accent: '#7793a4',
    skills: ['Motion identity', 'Animated type', 'Explainers'], tools: ['After Effects', 'Blender', 'Runway Gen-4'], formats: ['Animation', 'Video'], rate: 2600, availability: 'Available in 2 weeks', commercialUse: 'Paid + organic · worldwide',
    work: [{ id: 'ms-01', title: 'Signal / noise', category: 'Brand motion', image: asset('editing-timeline.jpg'), description: 'A motion identity that gives a culture platform a visible tempo.', contentType: 'Animation', aspectRatio: '16:9', duration: '25 sec', tools: ['After Effects', 'Blender'], workflow: ['Motion language', 'Scene blocks', 'Final system'], role: 'Motion designer', licensing: 'Paid + organic' }]
  },
  {
    id: 'ravi-jain', name: 'Ravi Jain', initials: 'RJ', specialty: 'Generative artist', location: 'Mumbai · UTC+5:30',
    bio: 'Artist and image-maker building high-density visual worlds for music, culture, and experimental commerce.', accent: '#aeb0a7',
    skills: ['Worldbuilding', 'Album art', 'Visual research'], tools: ['ComfyUI', 'Midjourney V7', 'TouchDesigner'], formats: ['Image', 'Campaign'], rate: 1300, availability: 'Available now', commercialUse: 'Organic + editorial · worldwide',
    work: [{ id: 'rj-01', title: 'No fixed address', category: 'Music visual', image: asset('studio-light.jpg'), description: 'A nocturnal visual language for a record that refuses a single genre.', contentType: 'Image', aspectRatio: '1:1', tools: ['ComfyUI', 'TouchDesigner'], workflow: ['Image research', 'Latent studies', 'Release set'], role: 'Artist', licensing: 'Editorial, organic, music releases' }]
  },
  {
    id: 'ines-cho', name: 'Ines Cho', initials: 'IC', specialty: 'AI fashion', location: 'Paris · UTC+1',
    bio: 'Creative technologist combining physical styling with generative image work for fashion and beauty brands.', accent: '#c9d43a',
    skills: ['Styling', 'Beauty image', 'Campaign direction'], tools: ['Flux Pro', 'Photoshop', 'Magnific'], formats: ['Image', 'Campaign'], rate: 3400, availability: 'Available next month', commercialUse: 'Paid + organic · worldwide',
    work: [{ id: 'ic-01', title: 'Soft armor', category: 'Beauty launch', image: asset('fashion-editorial.jpg'), description: 'A beauty campaign where protection and softness occupy the same frame.', contentType: 'Image', aspectRatio: '4:5', tools: ['Flux Pro', 'Photoshop'], workflow: ['Material palette', 'Look development', 'Retouch'], role: 'Creative technologist', licensing: 'Paid + organic; source files available' }]
  },
  {
    id: 'leo-finn', name: 'Leo Finn', initials: 'LF', specialty: 'Social video producer', location: 'Berlin · UTC+1',
    bio: 'Producer-editor for sharp social stories, product explainers, and campaigns with momentum baked in.', accent: '#7793a4',
    skills: ['Performance edit', 'Hooks', 'Creator direction'], tools: ['Kling 2.1', 'CapCut', 'Runway Gen-4'], formats: ['Video', 'Campaign'], rate: 1700, availability: 'Available in 10 days', commercialUse: 'Paid + organic · Europe',
    work: [{ id: 'lf-01', title: 'A better kind of fast', category: 'Tech social', image: asset('vertical-video.jpg'), description: 'A launch sequence cut for speed, clarity, and a clean first-frame hook.', contentType: 'Video', aspectRatio: '9:16', duration: '18 sec', tools: ['Kling 2.1', 'CapCut'], workflow: ['Hook map', 'Batch gen', 'Platform versions'], role: 'Producer · editor', licensing: 'Paid + organic for 6 months' }]
  }
]

export const briefs: Brief[] = [
  { id: 'brief-01', title: 'Runway / everyday object', idea: 'A 20-second vertical film for a new sneaker that feels like an object from a near future.', objective: 'Launch a new sneaker line', audience: 'Design-aware Gen Z', contentType: 'Video', style: 'Cinematic, tactile, slightly strange', platform: 'Instagram Reels', aspectRatio: '9:16', duration: '20 sec', budgetMin: 1800, budgetMax: 3600, commercialUse: 'Paid + organic · worldwide', requiredTools: ['Runway Gen-4'], requiredSkills: ['Product storytelling', 'Vertical edit'], status: 'Published' },
  { id: 'brief-02', title: 'Glass house / summer', idea: 'A modular still life series for a glassware collection.', objective: 'Build a launch image library', audience: 'Design-conscious home buyers', contentType: 'Image', style: 'Warm, graphic, quiet', platform: 'Web + paid social', aspectRatio: '4:5', duration: 'n/a', budgetMin: 1200, budgetMax: 2200, commercialUse: 'Paid + organic · worldwide', requiredTools: ['Flux Pro'], requiredSkills: ['Product stills', 'Art direction'], status: 'Draft' },
  { id: 'brief-03', title: 'The future is soft', idea: 'A motion identity film for a culture platform.', objective: 'Introduce a new visual language', audience: 'Artists and independent makers', contentType: 'Animation', style: 'Precise, playful, human', platform: 'Web + launch event', aspectRatio: '16:9', duration: '30 sec', budgetMin: 2000, budgetMax: 3200, commercialUse: 'Paid + organic · worldwide', requiredTools: ['Blender'], requiredSkills: ['Motion identity'], status: 'In progress' },
  { id: 'brief-04', title: 'No paid media', idea: 'A visual world for a small music release with organic use only.', objective: 'Create a release visual kit', audience: 'Independent music listeners', contentType: 'Image', style: 'Nocturnal, grainy, atmospheric', platform: 'Instagram + streaming', aspectRatio: '1:1', duration: 'n/a', budgetMin: 700, budgetMax: 1600, commercialUse: 'Organic + editorial · worldwide', requiredTools: [], requiredSkills: ['Album art'], status: 'Published' },
  { id: 'brief-05', title: 'A room remembers', idea: 'A 45-second hospitality film with paid advertising across North America.', objective: 'Launch a new boutique property', audience: 'Weekend travelers', contentType: 'Video', style: 'Documentary, warm, sound-led', platform: 'Web + paid video', aspectRatio: '16:9', duration: '45 sec', budgetMin: 2400, budgetMax: 5000, commercialUse: 'Paid + organic · North America', requiredTools: ['Sora'], requiredSkills: ['Brand film'], status: 'Published' }
]

export const categories = ['AI filmmaking', 'AI animation', 'Product advertising', 'Generative art', 'AI fashion', 'Social video']

export const featuredCreators = creators.slice(0, 4)

export function scoreCreator(creator: Creator, brief: Brief): MatchResult {
  const skillMatch = brief.requiredSkills.length ? brief.requiredSkills.filter((skill) => creator.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(s.toLowerCase()))).length / brief.requiredSkills.length : 1
  const formatMatch = creator.formats.includes(brief.contentType) ? 1 : 0.25
  const toolMatch = brief.requiredTools.length ? brief.requiredTools.filter((tool) => creator.tools.some((t) => t.toLowerCase().includes(tool.toLowerCase().split(' ')[0] ?? ''))).length / brief.requiredTools.length : 1
  const budgetMatch = brief.budgetMax ? creator.rate <= brief.budgetMax ? (brief.budgetMin && creator.rate >= brief.budgetMin ? 1 : 0.78) : 0.18 : 0.65
  const rightsHardFail = brief.commercialUse.includes('Paid') && !creator.commercialUse.includes('Paid')
  const rightsMatch = rightsHardFail ? 0 : creator.commercialUse.includes(brief.commercialUse.split(' · ')[0] ?? '') || brief.commercialUse.includes('Organic') ? 1 : 0.55
  const breakdown = [
    { label: 'Skills + specialty', score: Math.round(skillMatch * 100), weight: 30 },
    { label: 'Format compatibility', score: Math.round(formatMatch * 100), weight: 20 },
    { label: 'Tools + workflow', score: Math.round(toolMatch * 100), weight: 15 },
    { label: 'Budget fit', score: Math.round(budgetMatch * 100), weight: 15 },
    { label: 'Commercial use', score: Math.round(rightsMatch * 100), weight: 20 },
  ]
  const total = Math.round(breakdown.reduce((sum, item) => sum + item.score * item.weight / 100, 0))
  const reasons = [
    skillMatch >= 0.75 ? `Strong match for ${creator.specialty.toLowerCase()}.` : 'Some required skills are not documented.',
    formatMatch >= 0.75 ? `Portfolio includes ${brief.contentType.toLowerCase()} work in the requested format.` : 'Requested content type is outside the strongest documented format.',
    toolMatch >= 0.75 ? 'Relevant production tools are documented in the profile.' : 'The required tool is not documented in the profile.',
    budgetMatch >= 0.78 ? 'Indicative rate sits inside or close to the brief range.' : 'Indicative rate may exceed the stated range.',
    rightsMatch === 1 ? 'Commercial-use terms appear compatible, subject to contract review.' : 'Commercial-use scope needs a contract review.'
  ]
  return { creator, total, eligible: !rightsHardFail && formatMatch > 0 && total > 35, breakdown, reasons, ...(rightsHardFail ? {mismatch: 'Mandatory paid-media compatibility is not documented.'} : {}) }
}

export function matchBrief(brief: Brief): MatchResult[] {
  return creators.map((creator) => scoreCreator(creator, brief)).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.total - a.total)
}
