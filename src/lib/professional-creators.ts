import portrait1 from "@/assets/professional-creator-1.jpg";
import portrait2 from "@/assets/professional-creator-2.jpg";
import portrait3 from "@/assets/professional-creator-3.jpg";
import portrait4 from "@/assets/professional-creator-4.jpg";
import portrait5 from "@/assets/professional-creator-5.jpg";
import portrait6 from "@/assets/professional-creator-6.jpg";
import portrait7 from "@/assets/professional-creator-7.jpg";
import portrait8 from "@/assets/professional-creator-8.jpg";

const portraits = [portrait1, portrait2, portrait3, portrait4, portrait5, portrait6, portrait7, portrait8];
const specialties = [
  { title: "Brand & motion designer", skills: ["Motion identity", "2D animation", "Storyboarding"], tools: ["After Effects", "Illustrator", "Figma"], project: "Launch motion identity", description: "A coordinated logo animation, typography system and social launch toolkit." },
  { title: "Commercial video editor", skills: ["Video editing", "Colour grading", "Sound design"], tools: ["Premiere Pro", "DaVinci Resolve", "Audition"], project: "Product launch film", description: "A 30-second product film with platform-ready vertical and widescreen edits." },
  { title: "Product photographer & art director", skills: ["Product photography", "Lighting", "Retouching"], tools: ["Lightroom", "Photoshop", "Capture One"], project: "Studio product collection", description: "A consistent set of studio photographs, detail shots and campaign visuals." },
  { title: "3D visual designer", skills: ["3D modelling", "Product rendering", "Animation"], tools: ["Blender", "Cinema 4D", "Photoshop"], project: "3D product showcase", description: "A product visualisation study with material development and animated turntables." },
  { title: "Social content strategist", skills: ["Creative strategy", "Short-form video", "Copywriting"], tools: ["CapCut", "Canva", "Notion"], project: "Social storytelling series", description: "A sample content series with a hook matrix, storyboards and short-form edits." },
  { title: "Brand identity designer", skills: ["Visual identity", "Typography", "Editorial design"], tools: ["Illustrator", "InDesign", "Figma"], project: "Independent brand identity", description: "A concept identity with a logo system, colour palette and brand guidelines." },
];
function indexFor(key: string, length: number) {
  return Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0) % length;
}
export function professionalPortrait(name: string) {
  return portraits[indexFor(name, portraits.length)];
}
export function professionalDemoProfile(handle: string) {
  const specialty = specialties[indexFor(handle, specialties.length)];
  if (!specialty) return null;
  return { ...specialty, bio: `${specialty.title} focused on thoughtful, production-ready creative work. From clear concepts and structured feedback to polished final assets, I build cohesive content for brand launches and digital campaigns.`, location: ["Hyderabad", "Bengaluru", "Mumbai", "New Delhi"][indexFor(handle, 4)] };
}