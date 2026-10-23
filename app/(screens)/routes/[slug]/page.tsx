import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin } from "lucide-react";
import { ROUTES } from "@/lib/ui/site-data";
import { DIET_PROFILES } from "@/lib/ui/diets";
import BookingForm from "@/components/routes/BookingForm";
import Timeline from "@/components/routes/Timeline";
import Reveal from "@/components/Reveal";
import RouteCard from "@/components/routes/RouteCard";

export function generateStaticParams() {
  return ROUTES.map((r) => ({ slug: r.slug }));
}

// stage 5: read routes from GET /api/routes/{slug} (spec 13.9) instead of lib/ui/site-data.
type Props = { params: Promise<{ slug: string }> }; // a Promise since Next 15

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = ROUTES.find((x) => x.slug === slug);
  return r ? { title: r.title, description: r.blurb } : {};
}

export default async function RouteDetail({ params }: Props) {
  const { slug } = await params;
  const r = ROUTES.find((x) => x.slug === slug);
  if (!r) notFound();
  const others = ROUTES.filter((x) => x.slug !== r.slug).slice(0, 3);

  return (
    <>
      <section className={`${r.color} relative overflow-hidden pb-16 pt-32 text-white md:pt-40`}>
        <p className="pointer-events-none absolute -bottom-10 right-0 select-none font-jp text-[160px] leading-none text-white/10 md:text-[240px]" aria-hidden>{r.jp.slice(0, 2)}</p>
        <Reveal className="container relative">
          <Link href="/routes" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"><ArrowLeft size={15} /> All routes</Link>
          <p className="mt-6 font-jp text-lg text-white/80">{r.jp}</p>
          <h1 className="mt-2 font-serif text-5xl leading-tight md:text-6xl">{r.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">{r.blurb}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
            <span className="flex items-center gap-1.5"><MapPin size={15} /> {r.city}</span>
            <span className="flex items-center gap-1.5"><Clock size={15} /> {r.days} day{r.days > 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1.5"><CalendarDays size={15} /> {r.season.join(", ")}</span>
          </div>
        </Reveal>
      </section>

      <section className="py-16 md:py-20">
        <div className="container grid gap-12 lg:grid-cols-[1fr_380px]">
          <div>
            <h2 className="font-serif text-3xl text-ai-600">The day, stop by stop</h2>
            <Timeline stops={r.stops} />

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {r.highlights.map((h) => <div key={h} className="rounded-2xl border border-washi-300 p-5 font-semibold text-ai-600">{h}</div>)}
            </div>

            <div className="mt-12 rounded-2xl border border-washi-300 p-6">
              <p className="font-semibold text-ai-600">Checked for these profiles</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(DIET_PROFILES) as (keyof typeof DIET_PROFILES)[]).map((d) => (
                  <span key={d} className={`chip ${r.suits.includes(d) ? "border-moss/40 text-moss" : "opacity-50 line-through"}`}>{DIET_PROFILES[d].label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start"><BookingForm title={r.title} price={r.priceINR} /></div>
        </div>
      </section>

      <section className="border-t border-washi-300 py-16">
        <div className="container">
          <h2 className="font-serif text-3xl text-ai-600">More Shojin Routes</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">{others.map((o) => <RouteCard key={o.slug} r={o} />)}</div>
        </div>
      </section>
    </>
  );
}
