import Link from "next/link";
import FeaturedToursSlice from "./components/FeaturedToursSlice";
import ContactUnifiedForm from "./components/ContactUnifiedForm";
import { prisma } from "../lib/prisma";

type FeaturedTourView = {
  id: number;
  title: string;
  image: string;
  description: string;
  categoryName: string;
  priceLabel: string;
  location: string;
  featured: boolean;
};

const TOUR_PLACEHOLDER_IMAGE = "/tour-placeholder.svg";

function buildFeaturedLocation(zone?: string | null, country?: string | null): string {
  const parts = [zone, country].map((item) => String(item ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : "";
}

function buildFeaturedPriceLabel(price?: number | null): string {
  const numeric = typeof price === "number" && Number.isFinite(price) ? price : 0;
  if (numeric === 0) return "Gratis";
  return `$${numeric.toFixed(2)}`;
}

function IconWrap({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">{children}</span>;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.62a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.46-1.2a2 2 0 0 1 2.11-.45c.84.3 1.72.51 2.62.63A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15 15 0 0 1 0 20" />
      <path d="M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 1.7 4.3L18 8l-4.3 1.7L12 14l-1.7-4.3L6 8l4.3-1.7L12 2z" />
      <path d="m19 14 1 2.4L22.4 17 20 18l-1 2.4L18 18l-2.4-1 2.4-1 1-2.4z" />
      <path d="m5 14 .8 1.8L7.6 17l-1.8.8L5 19.6l-.8-1.8L2.4 17l1.8-.8L5 14z" />
    </svg>
  );
}

export default async function Home() {
  let featuredTours: FeaturedTourView[] = [];

  try {
    const featuredRaw = await prisma.tour.findMany({
      where: { featured: true },
      orderBy: { id: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        images: true,
        zone: true,
        country: true,
        featured: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    featuredTours = featuredRaw.map((tour) => ({
      id: tour.id,
      title: tour.title,
      image: Array.isArray(tour.images) && tour.images[0] ? tour.images[0] : TOUR_PLACEHOLDER_IMAGE,
      description: String(tour.description ?? ""),
      categoryName: String(tour.category?.name ?? "Tour"),
      priceLabel: buildFeaturedPriceLabel(tour.price),
      location: buildFeaturedLocation(tour.zone, tour.country),
      featured: Boolean(tour.featured),
    }));
  } catch {
    featuredTours = [];
  }

  return (
    <div>
      <section className="hero-wrap">
        <div className="mx-auto max-w-6xl px-4 py-24 text-white md:py-32">
          <p className="mb-3 inline-block rounded-full border border-white/40 bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-wide">
            Guapiles Linea Tours
          </p>
          <h1 className="script-title text-5xl leading-tight drop-shadow-md md:text-7xl">Descubre el turismo rural costarricense</h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold text-slate-100 md:text-2xl">
            Experiencias unicas y autenticas dentro y fuera del pais para todos los estilos de vida.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tours"
              className="rounded-lg bg-emerald-600 px-8 py-3 text-center text-lg font-extrabold shadow-xl shadow-emerald-950/25 transition hover:bg-emerald-500"
            >
              Ver tours
            </Link>
            <Link
              href="/contacto"
              className="rounded-lg bg-amber-400 px-8 py-3 text-center text-lg font-extrabold text-slate-900 shadow-xl shadow-amber-950/25 transition hover:bg-amber-300"
            >
              Explorar planes
            </Link>
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-extrabold text-emerald-900 md:text-4xl">Turismo rural, local e internacional</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              Trabajamos junto a familias, emprendedores y comunidades locales para crear experiencias seguras y de alta calidad.
              Tambien ofrecemos circuitos internacionales con acompanamiento cercano de principio a fin.
            </p>
            <div className="mt-6 grid gap-3 text-sm font-semibold text-emerald-900 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
                <IconWrap>
                  <GlobeIcon />
                </IconWrap>
                Experiencias nacionales e internacionales
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
                <IconWrap>
                  <SparkIcon />
                </IconWrap>
                Mas de 35 aliados turisticos
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm sm:col-span-2">
                <IconWrap>
                  <ShieldIcon />
                </IconWrap>
                Atencion cercana y personalizada en cada etapa del viaje
              </div>
            </div>
          </div>
          <img
            src="https://images.unsplash.com/photo-1659120409178-afa7c3630bb4?auto=format&fit=crop&w=1000&q=80"
            alt="Guia local de turismo"
            className="h-72 w-full rounded-2xl object-cover shadow-xl"
          />
        </div>
      </section>

      {featuredTours.length > 0 && (
        <section className="jungle-band py-12 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-extrabold">Tours destacados</h2>
            <FeaturedToursSlice tours={featuredTours} />
          </div>
        </section>
      )}

      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-4xl font-extrabold text-emerald-900">Por que elegir Guapiles Linea Tours</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Turismo responsable", desc: "Viajes que aportan a comunidades y tradiciones locales", icon: <GlobeIcon /> },
              { title: "Calidad y seguridad", desc: "Operadores confiables y experiencias bien coordinadas", icon: <ShieldIcon /> },
              { title: "Destinos variados", desc: "Naturaleza, playa y ciudad en una sola propuesta", icon: <MapPinIcon /> },
              { title: "Acompanamiento real", desc: "Atencion personalizada antes, durante y despues del viaje", icon: <PhoneIcon /> },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="mb-3">
                  <IconWrap>{item.icon}</IconWrap>
                </div>
                <p className="text-xl font-extrabold text-emerald-900">{item.title}</p>
                <p className="mt-2 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="jungle-band py-12 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-4xl font-extrabold">Contactanos directamente</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <h3 className="text-2xl font-extrabold">Canales de atencion</h3>
              <div className="mt-4 space-y-3 text-sm font-semibold text-emerald-50">
                <p className="flex items-center gap-2"><PhoneIcon /> +506 6015 9782 / +506 7154 6738</p>
                <p className="flex items-center gap-2"><MailIcon /> atencionalcliente@guapileslineatours.com</p>
                <p className="flex items-center gap-2"><ClockIcon /> Lunes a Viernes, 8:00 am a 5:00 pm</p>
                <p className="flex items-center gap-2"><MapPinIcon /> Costa Rica, Limon, Pococi, La Colonia</p>
              </div>
            </article>

            <article className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <h3 className="text-2xl font-extrabold">Prefieres atencion guiada</h3>
              <p className="mt-3 text-emerald-50">
                Te orientamos segun tu presupuesto, tipo de experiencia y tiempo disponible para que reserves con confianza.
              </p>
              <Link
                href="/contacto"
                className="mt-5 inline-block rounded-lg bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-amber-300"
              >
                Ir al centro de contacto
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold text-emerald-900">Listo para planear tu aventura</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <ContactUnifiedForm className="grid gap-3 md:grid-cols-3" />
            </div>

            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4882.188570334864!2d-83.8047022!3d10.2454627!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8fa0b9c803e1fc55%3A0x4b43d6084e269201!2sLINEA%20TOURS%20-%20Agencia%20de%20Viajes!5e1!3m2!1ses!2scr!4v1774907290615!5m2!1ses!2scr"
                width="400"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-56 w-full"
                title="Mapa de LINEA TOURS"
              />
              <div className="space-y-2 p-4 text-sm text-slate-700">
                <p className="flex items-center gap-2"><MapPinIcon /> Guapiles, Limon, Costa Rica</p>
                <p className="flex items-center gap-2"><ShieldIcon /> Operadores certificados y respaldo local</p>
                <p className="flex items-center gap-2"><GlobeIcon /> Experiencias rurales, playa y aventura</p>
                <Link href="/contacto" className="mt-2 inline-block font-extrabold text-emerald-700">Ver contacto completo</Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
