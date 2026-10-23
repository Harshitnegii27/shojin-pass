import type { ReactNode } from "react";

export default function Phone({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative w-[270px] rounded-[2.6rem] bg-sumi p-2.5 shadow-float ${className}`}>
      <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-sumi" />
      <div className="overflow-hidden rounded-[2.1rem] bg-washi-50">
        <div className="bg-ai-600 px-5 pb-3 pt-9 text-white">
          <p className="text-[15px] font-semibold">{title}</p>
          {subtitle && <p className="text-[11px] text-white/70">{subtitle}</p>}
        </div>
        <div className="min-h-[400px] p-4">{children}</div>
      </div>
    </div>
  );
}
