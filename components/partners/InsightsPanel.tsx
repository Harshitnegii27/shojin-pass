"use client";
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDiet } from "@/lib/ui/diet-context";
import { useShojin } from "@/lib/ui/shojin-context";
import type { Insights } from "@/lib/ui/stage5";

// Live totals from GET /api/insights (via shojinClient): verdict colours and the top red ingredients.
// No user ids reach the browser, and the server hides every count under 5.
const COLOUR = [
  { key: "green", label: "No avoided ingredients found", cls: "bg-moss" },
  { key: "amber", label: "Check with staff", cls: "bg-amber" },
  { key: "red", label: "Not suitable", cls: "bg-shu" },
  { key: "retake", label: "Retake the photo", cls: "bg-ai-400" },
] as const;

export default function InsightsPanel() {
  const { client } = useShojin();
  const { lang } = useDiet();
  const [data, setData] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    client.insights().then((r) => {
      if (!live) return;
      setFailed(!r.ok);
      if (r.ok) setData(r.data as Insights);
    });
    return () => { live = false; };
  }, [client]);

  const shown = (n: number | null) => (n === null ? `fewer than ${data?.minCount ?? 5}` : n.toLocaleString("en-IN"));
  const nothing = data && data.totalScans === null;

  return (
    <div className="card p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Live scanner insights</p>
          <p className="mt-2 font-serif text-3xl text-ai-600">What travellers are scanning</p>
          <p className="mt-1 text-sm text-sumi-500">
            Totals from the last {data?.windowDays ?? 90} days of scans. No personal data; any count under {data?.minCount ?? 5} is hidden.
          </p>
        </div>
        <BarChart3 className="shrink-0 text-shu" />
      </div>

      {!data && !failed && <p className="mt-6 text-sm text-sumi-400">Loading…</p>}
      {failed && <p className="mt-6 text-sm text-sumi-500">Insights are unavailable right now.</p>}
      {nothing && <p className="mt-6 rounded-xl bg-washi-100 p-4 text-sm text-sumi-500">Not enough scans yet to show totals.</p>}

      {data && !nothing && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ai-600">Verdicts · {shown(data.totalScans)} scans</p>
            <ul className="mt-3 space-y-2">
              {COLOUR.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 rounded-xl bg-washi-100 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${c.cls}`} />{c.label}</span>
                  <span className="font-semibold text-sumi">{shown(data.colours[c.key])}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ai-600">Top red ingredients</p>
            {data.topRed.length === 0 ? (
              <p className="mt-3 text-sm text-sumi-500">None seen in at least {data.minCount} scans yet.</p>
            ) : (
              <ol className="mt-3 space-y-1.5 text-sm">
                {data.topRed.map((r, i) => (
                  <li key={r.ingredientId} className="flex items-center justify-between gap-3">
                    <span>{i + 1}. {r.name[lang] ?? r.name.en ?? r.ingredientId}</span>
                    <span className="font-semibold text-shu">{r.scans.toLocaleString("en-IN")} scans</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
      {data?.capped && <p className="mt-4 text-xs text-sumi-400">Based on the most recent 10,000 scans.</p>}
    </div>
  );
}
