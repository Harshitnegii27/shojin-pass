// All copy and data for the landing page lives here so the team can edit
// without touching components. Figures are from the Team Kakehashi deck (JNTO,
// Japan Tourism Agency, Pew 2021, India Tourism Data Compendium 2025).

export const STATS = [
  { value: 315062, prefix: "", suffix: "", label: "Indian visitors to Japan in 2025, a record (JNTO)" },
  { value: 35.2, prefix: "+", suffix: "%", decimals: 1, label: "Year-on-year growth in Indian arrivals" },
  { value: 249807, prefix: "¥", suffix: "", label: "Spend per Indian visitor (Japan Tourism Agency)" },
  { value: 39, prefix: "", suffix: "%", label: "of Indian adults are vegetarian (Pew, 2021)" },
];

export const BARRIERS = [
  { title: "Food trust", body: "Dashi, bonito and egg hide in “vegetable” dishes. Labels are in Japanese, so families carry food from home.", fix: "No — it’s a confidence problem", tone: "shu" },
  { title: "Information", body: "Japan is sold through anime and sushi. Vegetarian Japan has no story in India, so the family vetoes the trip.", fix: "No — it’s a narrative problem", tone: "shu" },
  { title: "Language", body: "Menus, konbini shelves and restaurant staff mostly use Japanese. Asking about ingredients is hard.", fix: "No", tone: "shu" },
  { title: "Perceived cost", body: "Japan feels expensive next to Thailand or Dubai.", fix: "Only partly — perceived value is the lever", tone: "amber" },
] as const;

export const JOURNEY = [
  { stage: "India · Inspire", title: "“Sattvic Japan” campaign", body: "“Japan cooks like your naani’s kitchen.” Content with Indian food creators and Jain community groups.", color: "bg-shu text-white", accent: "text-white/70" },
  { stage: "India · Plan", title: "Dietary profile + Shojin Routes", body: "Set once: vegetarian, eggless, no onion or garlic, or Jain. Book curated temple-cuisine days in Kyoto and Koyasan.", color: "bg-ai-600 text-white", accent: "text-white/60" },
  { stage: "Japan · Experience", title: "Trust Scanner + partner mark", body: "Point at any label or menu, get a verdict and a reason in English or Hindi. Partner venues are pre-checked.", color: "bg-washi-50 text-ai-600 border border-washi-300", accent: "text-sumi-400" },
  { stage: "India · Return", title: "Cross-bound loop", body: "Buy the Japanese products you scanned, back home in India. Inbound becomes outbound.", color: "bg-moss text-white", accent: "text-white/70" },
];

export const ROUTE = [
  { time: "08:30", title: "Zen garden visit", place: "Arashiyama temple area", tag: "" },
  { time: "12:00", title: "Temple cuisine lunch", place: "Shōjin ryōri course", tag: "Jain menu pre-arranged" },
  { time: "15:00", title: "Tea ceremony", place: "Matcha and sweets", tag: "Eggless checked" },
  { time: "19:00", title: "Partner dinner", place: "Shojin Pass venue", tag: "Verified" },
];

export const COMPARE = {
  cols: ["Google Lens / Translate", "HappyCow", "Shojin Pass"],
  rows: [
    { label: "Reads Japanese labels", v: ["yes", "no", "yes"] },
    { label: "Judges against Indian diet rules", v: ["no", "partial", "yes"] },
    { label: "Explains why", v: ["no", "no", "yes"] },
    { label: "Creates a new reason to visit", v: ["no", "no", "yes"] },
    { label: "Polite two-way card for the chef", v: ["partial", "no", "yes"] },
  ],
};

export const PARTNERS = [
  { name: "Hakuhodo", role: "Owns the “Sattvic Japan” story and India campaign" },
  { name: "JNTO + prefectures", role: "Co-fund Shojin Routes, promote at India roadshows" },
  { name: "Airlines", role: "Same dietary profile for in-flight meals" },
  { name: "Temples & ryokans", role: "Earn the Shojin Pass mark via a 10-point checklist" },
  { name: "Konbini & food brands", role: "“Veg-OK” shelf tags, sold again in India" },
  { name: "Indian OTAs", role: "Sell Shojin Routes as premium packages" },
];

export const FAQ = [
  { q: "Is the AI deciding whether I can eat something?", a: "No. A curated ingredient rulebook decides. The language model only writes the explanation in English or Hindi. Anything unclear is marked amber, “ask staff”, never a confident “safe”." },
  { q: "Does it work for strict Jain diets?", a: "Yes. You choose your profile — vegetarian, eggless, no onion or garlic, or Jain strict/flexible — and every verdict is judged against those rules." },
  { q: "What if my parents don’t use smartphones?", a: "Every profile comes with a printable “Show the Chef” card in polite Japanese, so elders can travel with the same confidence." },
  { q: "Is it free?", a: "Free for travellers. Tourism bodies sponsor routes, venues pay a certification fee, and bookings carry a commission. No discounts anywhere." },
  { q: "Where does it launch first?", a: "Kyoto: 30 certified venues and 5 Shojin Routes in the first 90 days, with the campaign in Ahmedabad, Mumbai and Bengaluru." },
];
