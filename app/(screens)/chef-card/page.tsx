import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ChefCard from "@/components/chef/ChefCard";

export const metadata: Metadata = { title: "Show the Chef card", description: "A polite Japanese card that explains your vegetarian or Jain diet to the chef — with tap-to-reply answers." };

export default function ChefCardPage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader eyebrow="Show the Chef · omotenashi mode" jp="お願い" title={<>Ask politely. <em className="text-shu">Get a clear answer.</em></>}
          sub="A two-way card in respectful Japanese. Show it to the chef; they tap a reply that you can read. Print one for the elders in your family." />
      </div>
      <section className="pb-24 print:pt-0"><div className="container"><ChefCard /></div></section>
    </>
  );
}
