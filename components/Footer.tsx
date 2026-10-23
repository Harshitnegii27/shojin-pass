import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ai-900 pt-16 text-washi/70 print:hidden">
      <div className="container grid gap-10 pb-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm">A food-trust layer for Indian travellers in Japan. Built by Team Kakehashi <span className="font-jp">架け橋</span> — “a bridge” between India and Japan.</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-washi">Product</p>
          <ul className="mt-3 space-y-2"><li><a href="/scanner" className="hover:text-white">Trust Scanner</a></li><li><a href="/chef-card" className="hover:text-white">Show the Chef</a></li><li><a href="/routes" className="hover:text-white">Shojin Routes</a></li><li><a href="/venues" className="hover:text-white">Partner venues</a></li><li><a href="/partners" className="hover:text-white">For partners</a></li></ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-washi">Team</p>
          <ul className="mt-3 space-y-2"><li>Shubham Garg (Lead)</li><li>Harshit Negi</li><li>Karmanjot Singh</li></ul>
        </div>
      </div>
      {/* Oversized wordmark footer (Saaspo "unique footer" pattern) */}
      <p className="select-none whitespace-nowrap text-center font-jp text-[22vw] font-bold leading-[0.8] text-white/[0.05]" aria-hidden>精進パス</p>
      <div className="border-t border-white/10 py-5 text-center text-xs text-washi/40">Thapar Japan Hackathon 2026 · HAK-PS-01 · Sources: JNTO, Japan Tourism Agency, Pew Research Center (2021)</div>
    </footer>
  );
}
