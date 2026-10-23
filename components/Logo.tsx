"use client";
import { useIntro } from "@/lib/ui/intro-context";

export default function Logo({ light, sealId }: { light?: boolean; sealId?: string }) {
  const { phase } = useIntro();
  // While the welcome intro runs, the intro's seal stands in for this one.
  const hideSeal = !!sealId && phase !== "done";
  return (
    <span className="group flex items-center gap-2.5">
      <span id={sealId}
        className={`grid h-9 w-9 place-items-center rounded-full border-2 border-shu font-jp text-base font-bold text-shu transition-transform duration-700 group-hover:rotate-[360deg] ${hideSeal ? "opacity-0" : ""}`}>
        精
      </span>
      <span className={`font-serif text-xl font-semibold tracking-tight ${light ? "text-washi" : "text-ai-600"}`}>Shojin Pass</span>
    </span>
  );
}
