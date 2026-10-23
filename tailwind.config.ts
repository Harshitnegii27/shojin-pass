import type { Config } from "tailwindcss";

// Design tokens pulled from the Team Kakehashi deck:
// washi cream paper, indigo (ai-iro), vermilion (shu-iro), moss and amber verdict colours.
const config: Config = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/ui/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1.25rem", md: "2rem" }, screens: { "2xl": "1200px" } },
    extend: {
      colors: {
        washi: { DEFAULT: "#F5F1EA", 50: "#FBF9F5", 100: "#F5F1EA", 200: "#ECE5D8", 300: "#DDD2BF" },
        ai: { DEFAULT: "#1F3A5F", 50: "#EEF2F7", 100: "#D6DFEB", 400: "#3A5A85", 600: "#1F3A5F", 800: "#142740", 900: "#0D1A2C" },
        shu: { DEFAULT: "#C2432F", 50: "#FBEDEA", 100: "#F5D3CC", 500: "#C2432F", 600: "#A83625" },
        moss: { DEFAULT: "#5E7A3A", 50: "#EFF3E8", 500: "#5E7A3A", 600: "#4C6430" },
        amber: { DEFAULT: "#C98A1F", 50: "#FBF3E3", 500: "#C98A1F" },
        sumi: { DEFAULT: "#1B1B1F", 500: "#4A4A55", 400: "#6B6B78" },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        jp: ["var(--font-jp)", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(31,58,95,.04), 0 8px 24px -12px rgba(31,58,95,.18)",
        float: "0 20px 50px -20px rgba(13,26,44,.35)",
      },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        scan: { "0%": { top: "8%" }, "100%": { top: "86%" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        scan: "scan 2.2s ease-in-out infinite alternate",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
