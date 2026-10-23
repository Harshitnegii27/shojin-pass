"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import DietSelect from "./DietSelect";

const LINKS = [
  { href: "/scanner", label: "Scanner" },
  { href: "/chef-card", label: "Chef Card" },
  { href: "/routes", label: "Shojin Routes" },
  { href: "/venues", label: "Venues" },
  { href: "/partners", label: "For partners" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);
  // Pages with a dark full-bleed hero get a light nav until the user scrolls.
  const onDark = /^\/routes\/.+/.test(path) && !scrolled && !open;

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all print:hidden ${scrolled || open ? "border-b border-washi-300/70 bg-washi/85 backdrop-blur-md" : ""}`}>
      <nav className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Shojin Pass home"><Logo light={onDark} sealId="brand-seal" /></Link>
        <ul className={`hidden items-center gap-7 text-sm font-medium xl:flex ${onDark ? "text-white/80" : "text-sumi-500"}`}>
          {LINKS.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link className={`relative transition ${onDark ? "hover:text-white" : "hover:text-shu"} ${active ? (onDark ? "text-white" : "text-shu") : ""}`} href={l.href}>
                  {l.label}
                  {active && <motion.span layoutId="nav-underline" transition={{ type: "spring", stiffness: 380, damping: 30 }} className={`absolute -bottom-1.5 left-0 h-0.5 w-full rounded ${onDark ? "bg-white" : "bg-shu"}`} />}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="hidden items-center gap-3 xl:flex">
          <DietSelect />
          <Link href="/scanner" className="btn-primary py-2.5">Scan a label</Link>
        </div>
        <button className={`xl:hidden ${onDark ? "text-white" : "text-ai-600"}`} onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      <AnimatePresence>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden border-t border-washi-300 bg-washi px-5 pb-6 xl:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block border-b border-washi-200 py-3 font-medium text-ai-600">{l.label}</Link>
          ))}
          <DietSelect className="mt-4" />
          <Link href="/scanner" className="btn-primary mt-4 w-full">Scan a label</Link>
        </motion.div>
      )}
      </AnimatePresence>
    </header>
  );
}
