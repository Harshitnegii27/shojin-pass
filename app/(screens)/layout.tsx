import type { ReactNode } from "react";
import { env } from "@/lib/config/env";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ShojinProvider } from "@/lib/ui/shojin-context";
import { DietProvider } from "@/lib/ui/diet-context";
import MotionRoot from "@/components/motion/MotionRoot";
import ScrollProgress from "@/components/motion/ScrollProgress";
import Intro from "@/components/Intro";
import { IntroProvider } from "@/lib/ui/intro-context";

// The app screens: header, footer, intro and the shared providers. /dev stays outside this group.
// Only public values reach the browser.
export default function ScreensLayout({ children }: { children: ReactNode }) {
  return (
    <ShojinProvider
      supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL ?? null}
      supabaseAnonKey={env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null}
      turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
    >
      <MotionRoot>
        <IntroProvider>
          <DietProvider>
            <Intro />
            <ScrollProgress />
            <Nav />
            <main>{children}</main>
            <Footer />
          </DietProvider>
        </IntroProvider>
      </MotionRoot>
    </ShojinProvider>
  );
}
