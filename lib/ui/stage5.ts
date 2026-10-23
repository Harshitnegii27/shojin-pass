// Shapes of the stage 5 API replies the screens use (routes, venues, chef card, insights), and the
// sample counts shown in page copy. The data itself comes from the server via shojinClient.
import routeData from "@/data/routes.json";
import venueData from "@/data/venues.json";
import type { Diet, Lang } from "./diets";

export type Venue = {
  id: string; nameEn: string; nameJa: string; type: "Temple" | "Restaurant" | "Ryokan" | "Konbini";
  city: "Kyoto" | "Koyasan"; area: string; distanceM?: number; certifiedAt: string | null;
  servesBeforeSunset: boolean; supports: Diet[]; priceLevel: string; note: string;
  map: { x: number; y: number }; sample: boolean; sampleNote: string | null;
};

export type Stop = {
  day: number; start: string; title: string; place: string; note?: string; isMeal: boolean;
  venueId?: string; venue?: Venue | null; sunsetConflict?: boolean; suggestEarly?: string | null;
};

export type RouteSummary = {
  slug: string; title: string; titleJa: string; city: "Kyoto" | "Koyasan"; days: number;
  samplePriceINR: number; season: string[]; color: string; blurb: string; highlights: string[];
  dietPresets: Diet[]; fitsDiet: boolean | null; note?: string; sample: boolean;
};

export type RouteDetail = RouteSummary & {
  lat: number; lng: number; date: string; sunsetRule: boolean; stops: Stop[];
  sunsets: { day: number; date: string; sunset: string }[];
};

export type ChefLine = { kind: "identity" | "forbid" | "ask" | "question"; ja: string } & Record<Lang, string>;
export type ChefCard = {
  identity: "jain" | "vegetarian"; lines: ChefLine[]; ja: string;
  buttons: ({ id: string; ja: string } & Record<Lang, string>)[];
  profiles: { preset: Diet; options: string[] }[];
  issuedAt: string; issuedAtJst: string; reviewNeeded: { ja: boolean; hi: boolean; gu: boolean; note: string };
};

export type Insights = {
  windowDays: number; since: string | null; generatedAt: string; minCount: number; totalScans: number | null;
  colours: Record<"green" | "amber" | "red" | "retake", number | null>;
  topRed: { ingredientId: string; name: Partial<Record<Lang, string>>; scans: number }[];
  capped: boolean;
};

export const SUNSET_OPTION = "no_food_after_sunset";

// Counts for page copy, taken from the sample data so the numbers on screen are always true.
export const SAMPLE_COUNTS = { venues: venueData.venues.length, routes: routeData.routes.length };
