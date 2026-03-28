import type { Metadata } from "next";
import Link from "next/link";
import { Nunito, Kaushan_Script } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const kaushan = Kaushan_Script({
  variable: "--font-kaushan",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Guapiles Linea Tours",
  description: "Sitio web de tours y aventuras en Costa Rica",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${nunito.variable} ${kaushan.variable} min-h-screen bg-slate-100 text-slate-900`}>
        <header className="site-header">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-2xl font-extrabold tracking-tight text-white">
              Guapiles Linea Tours
            </Link>
            <nav className="hidden gap-6 text-sm font-bold uppercase tracking-wide text-slate-100 md:flex">
              <Link href="/">Inicio</Link>
              <Link href="/tours">Tours</Link>
              <Link href="/quienes-somos">Nosotros</Link>
              <Link href="/contacto">Contacto</Link>
            </nav>
            <Link
              href="/tours"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg shadow-amber-900/20 transition hover:bg-amber-300"
            >
              Reserva ahora
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-12 bg-slate-900 py-10 text-slate-200">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-2xl font-extrabold text-white">Guapiles Linea Tours</p>
              <p className="text-sm text-slate-400">Tours de prueba para desarrollo y demostraciones.</p>
            </div>
            <nav className="flex flex-wrap gap-4 text-sm font-semibold">
              <Link href="/">Inicio</Link>
              <Link href="/tours">Tours</Link>
              <Link href="/quienes-somos">Sobre nosotros</Link>
              <Link href="/contacto">Contacto</Link>
            </nav>
            <p className="text-xs text-slate-400">© 2026 Guapiles Linea Tours. Todos los derechos reservados.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
