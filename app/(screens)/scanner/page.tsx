import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Scanner from "@/components/scanner/Scanner";

export const metadata: Metadata = { title: "Trust Scanner", description: "Check any Japanese food label against your vegetarian, eggless or Jain diet." };

export default function ScannerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trust Scanner"
        jp="原材料"
        title={<>Can I eat this? <em className="text-shu">Know in two seconds.</em></>}
        sub="Add everyone who’s eating, scan a label, and see who can eat it, with the reason in English or हिंदी."
      />
      <section className="pb-12 md:pb-24">
        <div className="container">
          <Scanner />
          <div className="mt-12 hidden gap-4 md:grid md:grid-cols-3">
            {[
              ["Read", "Japanese OCR pulls the ingredient list (原材料名) off the label or menu photo."],
              ["Match", "Every term is matched against a curated rulebook, tagged per diet: vegetarian, eggless, no onion-garlic, Jain flexible or strict."],
              ["Explain, honestly", "You get the reason in plain language. Anything unclear is amber — ask staff — never a confident “safe”."],
            ].map(([t, b], i) => (
              <div key={t} className="rounded-2xl border border-washi-300 p-6">
                <p className="font-serif text-3xl text-shu">{i + 1}</p>
                <p className="mt-2 font-semibold text-ai-600">{t}</p>
                <p className="mt-1 text-sm text-sumi-500">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
