import type { Diet } from "./diets";

// ── Shojin Routes ───────────────────────────────────────────────────────────
export type Stop = { time: string; title: string; place: string; note?: string; food?: boolean };
export type RouteT = {
  slug: string; title: string; jp: string; city: "Kyoto" | "Koyasan"; days: number; priceINR: number;
  season: string[]; blurb: string; highlights: string[]; suits: Diet[]; color: string; stops: Stop[];
};

// stage 5: routes come from GET /api/routes (spec 13.9); this is demo data until then.
export const ROUTES: RouteT[] = [
  {
    slug: "kyoto-zen-temple-day", title: "Kyoto Zen Temple Day", jp: "京都・禅寺の一日", city: "Kyoto", days: 1, priceINR: 14900,
    season: ["All year"], color: "bg-shu",
    blurb: "Zen gardens in Arashiyama, a full shōjin ryōri lunch inside a temple, and a tea ceremony — every meal pre-arranged for your profile.",
    highlights: ["Temple-cuisine lunch", "Tea ceremony", "Partner dinner"], suits: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible", "jain_strict"],
    stops: [
      { time: "08:30", title: "Zen garden visit", place: "Arashiyama temple area" },
      { time: "10:30", title: "Bamboo grove walk", place: "Sagano" },
      { time: "12:00", title: "Temple cuisine lunch", place: "Shōjin ryōri course", note: "Jain menu pre-arranged", food: true },
      { time: "15:00", title: "Tea ceremony", place: "Matcha and wagashi", note: "Eggless sweets checked", food: true },
      { time: "19:00", title: "Partner dinner", place: "Shojin Pass certified venue", note: "Verified", food: true },
    ],
  },
  {
    slug: "koyasan-temple-stay", title: "Koyasan Temple Stay", jp: "高野山・宿坊", city: "Koyasan", days: 2, priceINR: 38500,
    season: ["Apr–Nov"], color: "bg-ai-600",
    blurb: "Sleep in a mountain monastery, join the dawn prayer and eat the same shōjin ryōri the monks have cooked for twelve centuries.",
    highlights: ["Overnight shukubō", "Morning prayer", "Okunoin night walk"], suits: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible", "jain_strict"],
    stops: [
      { time: "Day 1 · 14:00", title: "Check in to temple lodging", place: "Shukubō, Koyasan" },
      { time: "Day 1 · 17:30", title: "Shōjin ryōri dinner", place: "Served in your room", note: "No onion, garlic or dashi", food: true },
      { time: "Day 1 · 19:30", title: "Okunoin cemetery night walk", place: "Lantern-lit forest path" },
      { time: "Day 2 · 06:00", title: "Morning prayer & fire ritual", place: "Main hall" },
      { time: "Day 2 · 07:30", title: "Temple breakfast", place: "Goma-dōfu, rice, pickles", note: "Root-veg free on request", food: true },
    ],
  },
  {
    slug: "arashiyama-tofu-and-tea", title: "Arashiyama Tofu & Tea", jp: "嵐山・湯豆腐と茶", city: "Kyoto", days: 1, priceINR: 9800,
    season: ["All year"], color: "bg-moss",
    blurb: "A gentle half-day built for grandparents: hot-pot tofu by the river, a riverside tea house and a short boat ride.",
    highlights: ["Yudōfu lunch", "River boat", "Elder-friendly pace"], suits: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible"],
    stops: [
      { time: "10:00", title: "Togetsukyō bridge", place: "Arashiyama riverside" },
      { time: "11:30", title: "Yudōfu lunch", place: "Kelp-broth tofu hot pot", note: "Kombu dashi only", food: true },
      { time: "13:30", title: "River boat", place: "Hozu river, short loop" },
      { time: "15:00", title: "Tea house", place: "Matcha and warabi-mochi", food: true },
    ],
  },
  {
    slug: "diwali-break-autumn-kyoto", title: "Diwali Break: Autumn Kyoto", jp: "紅葉の京都", city: "Kyoto", days: 3, priceINR: 52000,
    season: ["Oct–Nov"], color: "bg-amber",
    blurb: "Timed to the Diwali holidays and Kyoto’s red maples. Three days, three temple meals, one family-sized itinerary.",
    highlights: ["Maple-season temples", "3 temple meals", "Family rooms"], suits: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible", "jain_strict"],
    stops: [
      { time: "Day 1", title: "Higashiyama temples", place: "Lantern-lit autumn evening", note: "Partner dinner", food: true },
      { time: "Day 2", title: "Arashiyama + temple lunch", place: "Shōjin ryōri course", note: "Jain menu", food: true },
      { time: "Day 3", title: "Philosopher’s Path", place: "Tea ceremony and souvenir shopping", note: "Veg-OK konbini list", food: true },
    ],
  },
  {
    slug: "cherry-blossom-kyoto", title: "Cherry Blossom Kyoto", jp: "桜の京都", city: "Kyoto", days: 2, priceINR: 34500,
    season: ["Late Mar–Apr"], color: "bg-shu-600",
    blurb: "Hanami picnics with a pre-checked bento, evening illuminations and a temple breakfast under the blossoms.",
    highlights: ["Checked hanami bento", "Night illumination", "Temple breakfast"], suits: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible"],
    stops: [
      { time: "Day 1 · 12:00", title: "Hanami picnic", place: "Maruyama park", note: "Pre-checked bento", food: true },
      { time: "Day 1 · 19:00", title: "Night illumination", place: "Temple garden" },
      { time: "Day 2 · 08:00", title: "Temple breakfast", place: "Under the blossoms", food: true },
    ],
  },
];

// ── Partner venues (ILLUSTRATIVE demo data for the pilot — not real certifications) ──
export type VenueType = "Temple" | "Restaurant" | "Ryokan" | "Konbini";
export type Venue = {
  id: string; name: string; jp: string; type: VenueType; area: string; city: "Kyoto" | "Koyasan";
  diets: Diet[]; price: "¥" | "¥¥" | "¥¥¥"; x: number; y: number; note: string;
};

// stage 5: venues come from GET /api/venues (spec 13.10); illustrative demo data until then.
export const VENUES: Venue[] = [
  { id: "v1", name: "Seigan-an Temple Kitchen", jp: "清岸庵", type: "Temple", area: "Arashiyama", city: "Kyoto", diets: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible", "jain_strict"], price: "¥¥¥", x: 14, y: 48, note: "Full shōjin ryōri course; Jain menu on request" },
  { id: "v2", name: "Kawabe Yudōfu", jp: "川辺湯豆腐", type: "Restaurant", area: "Arashiyama", city: "Kyoto", diets: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible"], price: "¥¥", x: 20, y: 56, note: "Kombu-only broth, no bonito" },
  { id: "v3", name: "Higashiyama Midori", jp: "東山みどり", type: "Restaurant", area: "Higashiyama", city: "Kyoto", diets: ["vegetarian_egg", "vegetarian", "no_onion_garlic"], price: "¥¥", x: 72, y: 54, note: "Veg kaiseki; staff trained with chef card" },
  { id: "v4", name: "Ryokan Hanakago", jp: "旅館花籠", type: "Ryokan", area: "Gion", city: "Kyoto", diets: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible", "jain_strict"], price: "¥¥¥", x: 66, y: 46, note: "Family rooms; Jain breakfast" },
  { id: "v5", name: "Kamo Riverside Soba", jp: "鴨川そば", type: "Restaurant", area: "Kawaramachi", city: "Kyoto", diets: ["vegetarian_egg", "vegetarian"], price: "¥", x: 56, y: 40, note: "Kelp-shiitake tsuyu available" },
  { id: "v6", name: "Station Veg-OK Konbini", jp: "駅前コンビニ", type: "Konbini", area: "Kyoto Station", city: "Kyoto", diets: ["vegetarian_egg", "vegetarian", "no_onion_garlic"], price: "¥", x: 52, y: 78, note: "Veg-OK shelf tags on 40+ products" },
  { id: "v7", name: "Daimon Shukubō", jp: "大門宿坊", type: "Temple", area: "Koyasan west", city: "Koyasan", diets: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible", "jain_strict"], price: "¥¥¥", x: 22, y: 50, note: "Overnight temple lodging, dawn prayer" },
  { id: "v8", name: "Okunoin Tea House", jp: "奥之院茶屋", type: "Restaurant", area: "Okunoin", city: "Koyasan", diets: ["vegetarian_egg", "vegetarian", "no_onion_garlic", "jain_flexible"], price: "¥", x: 80, y: 38, note: "Goma-dōfu and matcha" },
];

// ── Certification checklist (deck: “10-point checklist”) ───────────────────────
export const CHECKLIST = [
  "Kombu / shiitake dashi available as a full substitute for bonito dashi",
  "Separate pot and utensils for Shojin Pass orders",
  "Ingredient list for every dish on the Shojin menu",
  "No gelatin, lard or animal extract in any Shojin dish",
  "Egg-free option for every Shojin dish",
  "Onion- and garlic-free preparation possible",
  "Root-vegetable-free option for strict Jain guests",
  "At least one staff member trained on the Show the Chef card",
  "Menu photos and labels uploaded for the scanner",
  "Agree to re-checks and guest feedback reviews",
];
