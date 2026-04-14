import type { Metadata } from "next";
import Link from "next/link";
import { Nunito_Sans } from "next/font/google";
import SiteHeader from "./components/SiteHeader";
import { siteConfig } from "../lib/siteConfig";
import "./globals.css";

const nunito = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: siteConfig.brandName,
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const performancePolyfill = `(function(){
    if (typeof window === "undefined") return;
    var perf = window.performance;
    if (!perf) return;
    try {
      if (typeof perf.clearMarks !== "function") perf.clearMarks = function() {};
      if (typeof perf.clearMeasures !== "function") perf.clearMeasures = function() {};
    } catch (e) {
      try {
        Object.defineProperty(perf, "clearMarks", {
          configurable: true,
          writable: true,
          value: function() {},
        });
      } catch (_) {}
      try {
        Object.defineProperty(perf, "clearMeasures", {
          configurable: true,
          writable: true,
          value: function() {},
        });
      } catch (_) {}
    }
  })();`;

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: performancePolyfill }} />
      </head>
      <body className={`${nunito.variable} min-h-screen bg-background text-foreground selection:bg-[var(--brand-gold)] selection:text-[#11151c]`}>
        <SiteHeader />
        <main>{children}</main>
        <footer className="mt-12 border-t border-white/10 bg-[#11161d]/95 py-10 text-slate-200">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:grid-cols-3 md:items-start">
            <div>
              <img
                src={siteConfig.logoPath}
                alt={siteConfig.brandName}
                className="h-14 w-auto max-w-[240px] object-contain"
              />
              <p className="mt-4 max-w-sm text-sm text-slate-400">
                Private, local, and authentic experiences to discover Costa Rica's Pacific coast with deeper connection and less mass tourism.
              </p>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-gold)]">Menu</p>
              <nav className="grid gap-2 text-sm font-semibold">
                <Link href="/">Home</Link>
                <Link href="/tours">Tours</Link>
                <Link href="/quienes-somos">About us</Link>
                <Link href="/contacto">Contact</Link>
              </nav>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-gold)]">Legal</p>
              <nav className="grid gap-2 text-sm font-semibold">
                <Link href="/legal/aviso-legal">Legal notice</Link>
                <Link href="/legal/terminos-y-condiciones-generales">General terms and conditions</Link>
                <Link href="/legal/politica-de-privacidad">Privacy policy</Link>
                <Link href="/legal/informacion-de-cookies">Cookie information</Link>
              </nav>
            </div>
            <p className="text-xs text-slate-400 md:col-span-3">© 2026 {siteConfig.brandName}. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
