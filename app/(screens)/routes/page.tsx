import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import RouteList from "@/components/routes/RouteList";

export const metadata: Metadata = { title: "Shojin Routes", description: "Curated temple-cuisine itineraries in Kyoto and Koyasan, checked for vegetarian and Jain diets." };

export default function RoutesPage() {
  return (
    <>
      <PageHeader eyebrow="Shojin Routes" jp="精進" title={<>Curated days that make food <em className="text-shu">the reason to go.</em></>}
        sub="Premium itineraries through Kyoto’s Zen temples and Koyasan’s monasteries. Every meal is pre-arranged and checked against your profile. Full price, no discounts — just certainty." />
      <section className="pb-24"><div className="container"><RouteList /></div></section>
    </>
  );
}
