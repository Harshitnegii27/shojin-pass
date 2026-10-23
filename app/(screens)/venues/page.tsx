import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import VenueExplorer from "@/components/venues/VenueExplorer";

export const metadata: Metadata = { title: "Partner venues", description: "Temples, restaurants, ryokans and konbini carrying the Shojin Pass mark." };

export default function VenuesPage() {
  return (
    <>
      <PageHeader eyebrow="Partner venues" jp="認定" title={<>Look for the mark. <em className="text-shu">Eat without asking twice.</em></>}
        sub="Every venue with the Shojin Pass mark will have passed a 10-point checklist: kelp dashi instead of bonito, separate utensils, ingredient lists, and staff trained on the chef card. The venues below are samples, not real certifications." />
      <section className="pb-24"><div className="container"><VenueExplorer /></div></section>
    </>
  );
}
