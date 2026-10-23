"use client";
import { CalendarDays, Sunset } from "lucide-react";
import { useEffect, useState } from "react";
import { useDiet } from "@/lib/ui/diet-context";
import { useShojin } from "@/lib/ui/shojin-context";
import { SUNSET_OPTION, type RouteDetail, type Stop } from "@/lib/ui/stage5";
import { todayJst } from "@/lib/time/jst";
import Timeline from "./Timeline";

// The day plan for one route: pick the travel date and the "no food after sunset" option; the server
// (GET /api/routes/{slug} via shojinClient) applies the sunset rule and returns each day's sunset.
// initialStops: rendered on the server so the page shows the stops before the browser asks.
export default function RoutePlan({ slug, days, initialStops }: { slug: string; days: number; initialStops: Stop[] }) {
  const { client } = useShojin();
  const { diet, options, setOptions } = useDiet();
  const [date, setDate] = useState(() => todayJst());
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const sunsetRule = options.includes(SUNSET_OPTION);

  useEffect(() => {
    let live = true;
    client.route(slug, { preset: diet, options: sunsetRule ? [SUNSET_OPTION] : [], date }).then((r) => {
      if (!live) return;
      setFailed(!r.ok);
      if (r.ok) setRoute(r.data as RouteDetail);
    });
    return () => { live = false; };
  }, [client, slug, diet, sunsetRule, date]);

  const toggle = (on: boolean) => setOptions(on ? [...options, SUNSET_OPTION] : options.filter((o) => o !== SUNSET_OPTION));
  const conflicts = route?.stops.filter((s) => s.sunsetConflict).length ?? 0;

  return (
    <div>
      <div className="mt-6 grid gap-3 rounded-2xl border border-washi-300 p-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-ai-600">
          <span className="flex items-center gap-1.5"><CalendarDays size={15} /> Travel date (day 1)</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-washi-300 bg-white px-3 py-2 font-normal text-sumi focus:border-ai-400 focus:outline-none" />
        </label>
        <label className="flex cursor-pointer items-start gap-2 self-end rounded-xl bg-washi-100 p-3 text-sm text-sumi-500">
          <input type="checkbox" checked={sunsetRule} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C2432F]" />
          <span><b className="text-ai-600">No food after sunset</b><br />Meals must start at least 45 minutes before sunset.</span>
        </label>
        {route && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sumi-500 sm:col-span-2">
            <Sunset size={16} className="text-shu" />
            {route.sunsets.map((s) => (
              <span key={s.day}>{days > 1 ? `Day ${s.day} (${s.date}): ` : `${s.date}: `}sunset <b className="text-ai-600">{s.sunset} JST</b></span>
            ))}
          </p>
        )}
        {route && sunsetRule && (
          <p className={`text-xs font-semibold sm:col-span-2 ${conflicts ? "text-shu" : "text-moss"}`}>
            {conflicts ? `${conflicts} meal${conflicts > 1 ? "s" : ""} too close to sunset on this date. See the suggestions below.` : "Every meal starts in time on this date."}
          </p>
        )}
        {failed && <p className="text-xs text-sumi-400 sm:col-span-2">Couldn’t check sunset times right now. The plan below is unchanged.</p>}
      </div>
      <Timeline stops={route?.stops ?? initialStops} multiDay={days > 1} />
    </div>
  );
}
