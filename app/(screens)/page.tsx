import Hero from "@/components/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import Features from "@/components/home/Features";
import Insight from "@/components/Insight";
import Faq from "@/components/Faq";
import Cta from "@/components/Cta";

// Home keeps only what a traveller needs. Pitch material (market stats, barrier
// analysis, competitor table, partner model) lives on /partners and /about.
export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Insight />
      <Faq />
      <Cta />
    </>
  );
}
