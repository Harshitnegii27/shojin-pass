"use client";
import { FlaskConical, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useDiet } from "@/lib/ui/diet-context";
import { useShojin } from "@/lib/ui/shojin-context";
import { DIET_PROFILES } from "@/lib/ui/diets";
import type { Venue } from "@/lib/ui/stage5";

type VenueType = Venue["type"];
// Where to search in each city (GET /api/venues: nearest first within the radius).
const CITY = { Kyoto: { lat: 35.0116, lng: 135.7681, radius: 15000 }, Koyasan: { lat: 34.213, lng: 135.5853, radius: 8000 } } as const;

const TYPES: ("All" | VenueType)[] = ["All", "Temple", "Restaurant", "Ryokan", "Konbini"];
const TYPE_COLOR: Record<VenueType, string> = { Temple: "bg-shu", Restaurant: "bg-ai-600", Ryokan: "bg-moss", Konbini: "bg-amber" };

// Stylised SVG maps — no map SDK or API key needed for the demo. Swap for Mapbox/Leaflet later.
function MapArt({ city }: { city: "Kyoto" | "Koyasan" }) {
  return city === "Kyoto" ? (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <path d="M0 0 L0 30 Q8 22 12 30 Q18 18 26 24 L30 0 Z" fill="#DDD2BF" opacity=".6" />
      <path d="M100 0 L100 70 Q92 60 88 66 Q82 50 86 40 Q80 30 84 0 Z" fill="#DDD2BF" opacity=".6" />
      <path d="M58 0 C57 20 61 35 58 50 C55 65 60 80 57 100" stroke="#9DB4CF" strokeWidth="2.2" fill="none" />
      <path d="M0 60 C10 55 18 62 26 56 C32 52 36 60 40 58" stroke="#9DB4CF" strokeWidth="1.6" fill="none" />
      {[20, 40, 60, 80].map((y) => <line key={y} x1="30" x2="80" y1={y} y2={y} stroke="#ECE5D8" strokeWidth=".6" />)}
      {[35, 45, 65, 75].map((x) => <line key={x} y1="15" y2="95" x1={x} x2={x} stroke="#ECE5D8" strokeWidth=".6" />)}
      <text x="8" y="40" fontSize="3" fill="#6B6B78">ARASHIYAMA</text>
      <text x="74" y="62" fontSize="3" fill="#6B6B78">HIGASHIYAMA</text>
      <text x="59" y="30" fontSize="2.6" fill="#3A5A85">Kamo river</text>
      <text x="44" y="90" fontSize="3" fill="#6B6B78">KYOTO STN</text>
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <path d="M0 100 L0 70 Q20 55 35 68 Q50 50 70 64 Q85 52 100 62 L100 100 Z" fill="#DDD2BF" opacity=".6" />
      <path d="M0 0 L0 22 Q25 34 50 20 Q75 32 100 18 L100 0 Z" fill="#DDD2BF" opacity=".6" />
      <path d="M10 50 C30 46 50 52 70 44 C80 40 88 38 95 36" stroke="#ECE5D8" strokeWidth="2" fill="none" />
      <text x="12" y="44" fontSize="3" fill="#6B6B78">DAIMON GATE</text>
      <text x="76" y="31" fontSize="3" fill="#6B6B78">OKUNOIN</text>
    </svg>
  );
}

export default function VenueExplorer() {
  const { client } = useShojin();
  const { diet } = useDiet();
  const [city, setCity] = useState<"Kyoto" | "Koyasan">("Kyoto");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [onlyMine, setOnlyMine] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [failed, setFailed] = useState(false);

  // The diet filter is done by the server (preset); the type filter only narrows what came back.
  useEffect(() => {
    let live = true;
    client.venues({ ...CITY[city], preset: onlyMine ? diet : undefined }).then((r) => {
      if (!live) return;
      setFailed(!r.ok);
      setVenues(r.ok ? (r.data as { venues: Venue[] }).venues : []);
    });
    return () => { live = false; };
  }, [client, city, onlyMine, diet]);

  const list = (venues ?? []).filter((v) => v.city === city && (type === "All" || v.type === type));

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["Kyoto", "Koyasan"] as const).map((c) => (
            <button key={c} onClick={() => { setCity(c); setActive(null); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${city === c ? "bg-ai-600 text-white" : "bg-washi-200 text-sumi-500"}`}>{c}</button>
          ))}
          <span className="mx-1 hidden w-px bg-washi-300 sm:block" />
          {TYPES.map((t) => (
            <button key={t} onClick={() => setType(t)} className={`rounded-full border px-3.5 py-1.5 text-sm transition ${type === t ? "border-shu bg-shu-50 text-shu" : "border-washi-300 text-sumi-500"}`}>{t}</button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-sumi-500">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="h-4 w-4 accent-[#C2432F]" />
          Only show venues for <b className="text-ai-600">{DIET_PROFILES[diet].label}</b>
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="card relative aspect-[4/3] overflow-hidden bg-washi-50 lg:aspect-auto lg:min-h-[560px]">
          <AnimatePresence mode="wait">
            <motion.div key={city} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <MapArt city={city} />
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>
          {list.map((v, i) => (
            <motion.button key={city + v.id} onClick={() => setActive(v.id)} style={{ left: `${v.map.x}%`, top: `${v.map.y}%` }}
              initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1, scale: active === v.id ? 1.25 : 1 }} exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: active === v.id ? 1.3 : 1.15 }}
              transition={{ type: "spring", stiffness: 300, damping: 15, delay: active ? 0 : i * 0.07 }}
              className={`absolute -ml-[18px] -mt-9 ${active === v.id ? "z-20" : "z-10"}`} aria-label={`${v.nameEn} (sample)`}>
              {active === v.id && <span className={`ping-soft absolute left-1/2 top-full -ml-2 -mt-2 h-4 w-4 rounded-full ${TYPE_COLOR[v.type]}`} aria-hidden />}
              <span className={`relative grid h-9 w-9 place-items-center rounded-full rounded-br-none rotate-45 border-2 border-white shadow-float ${TYPE_COLOR[v.type]}`}>
                <span className="-rotate-45 font-jp text-xs font-bold text-white">{v.nameJa[0]}</span>
              </span>
            </motion.button>
          ))}
          </AnimatePresence>
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-xl bg-white/90 px-3 py-2 text-[11px] text-sumi-500 backdrop-blur">
            {(Object.keys(TYPE_COLOR) as VenueType[]).map((t) => <span key={t} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${TYPE_COLOR[t]}`} />{t}</span>)}
          </div>
        </div>

        <ul className="space-y-3 lg:max-h-[560px] lg:overflow-y-auto lg:pr-1">
          {venues === null && <li className="card p-6 text-sm text-sumi-500">Loading sample venues…</li>}
          {failed && <li className="card p-6 text-sm text-sumi-500">Couldn’t load venues right now. Please try again.</li>}
          {venues !== null && !failed && list.length === 0 && <li className="card p-6 text-sm text-sumi-500">No sample venues here for this profile. Try another area or turn off the profile filter.</li>}
          <AnimatePresence mode="popLayout">
          {list.map((v, i) => (
            <motion.li key={v.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}>
              <button onClick={() => setActive(v.id)} className={`card w-full p-5 text-left transition ${active === v.id ? "ring-2 ring-shu" : "hover:border-ai-400/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl text-ai-600">{v.nameEn} <span className="font-jp text-sm text-sumi-400">{v.nameJa}</span></p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-sumi-400"><MapPin size={12} /> {v.area} · {v.type} · {v.priceLevel}{v.distanceM != null ? ` · ${(v.distanceM / 1000).toFixed(1)} km from the centre` : ""}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber"><FlaskConical size={13} /> {v.sampleNote ?? "Sample"}</span>
                </div>
                <p className="mt-2 text-sm text-sumi-500">{v.note}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {v.supports.map((d) => <span key={d} className={`rounded-full px-2 py-0.5 text-[11px] ${d === diet ? "bg-ai-600 text-white" : "bg-washi-200 text-sumi-500"}`}>{DIET_PROFILES[d].label}</span>)}
                </div>
              </button>
            </motion.li>
          ))}
          </AnimatePresence>
        </ul>
      </div>
      <p className="mt-4 text-xs font-semibold text-amber">Every venue shown is a sample with a made-up name — not a real certification.</p>
    </div>
  );
}
