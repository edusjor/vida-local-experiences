import Link from "next/link";
import path from "path";
import { readdir } from "fs/promises";
import FeaturedToursSlice from "./components/FeaturedToursSlice";
import ContactUnifiedForm from "./components/ContactUnifiedForm";
import ProvidersCarousel from "./components/ProvidersCarousel";
import { prisma } from "../lib/prisma";

type FeaturedTourView = {
  id: number;
  title: string;
  image: string;
  description: string;
  categoryName: string;
  priceLabel: string | null;
  location: string;
  featured: boolean;
};

type GoogleReview = {
  authorName: string;
  rating: number;
  text: string;
  relativeDate: string;
};

type GooglePlaceReviewsData = {
  placeName: string;
  rating: number;
  totalRatings: number;
  mapsUrl: string;
  reviews: GoogleReview[];
};

const TOUR_PLACEHOLDER_IMAGE = "/tour-placeholder.svg";
const GOOGLE_REVIEWS_URL = "https://maps.app.goo.gl/tqrezf2o6pirX9qx6";
const GOOGLE_PLACE_DEFAULT_QUERY = "LINEA TOURS - Agencia de Viajes, Guapiles, Costa Rica";
const PROVIDER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif"]);
const HERO_SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1580259679654-9276b39fd2d5?auto=format&fit=crop&w=2200&q=80",
    alt: "Montanas y bosque tropical",
  },
  {
    src: "https://images.unsplash.com/photo-1552727131-5fc6af16796d?auto=format&fit=crop&w=2200&q=80",
    alt: "Ave tropical sobre una rama",
  },
  {
    src: "https://images.unsplash.com/photo-1536709017021-ce8f99c17e38?auto=format&fit=crop&w=2200&q=80",
    alt: "Costa con mar azul y vegetacion",
  },
  {
    src: "https://images.unsplash.com/photo-1616890069499-f05321ca20fa?auto=format&fit=crop&w=2200&q=80",
    alt: "Perezoso en un arbol",
  },
  {
    src: "https://images.unsplash.com/photo-1602190629358-31a50de315e4?auto=format&fit=crop&w=2200&q=80",
    alt: "Atardecer en cuerpo de agua",
  },
] as const;

function ratingAsText(rating: number): string {
  const safe = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
  return safe.toFixed(1);
}

function formatRelativeDate(value?: string): string {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  return raw;
}

async function getGooglePlaceReviews(): Promise<GooglePlaceReviewsData | null> {
  const apiKey = String(process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
  if (!apiKey) return null;

  const query = String(process.env.GOOGLE_PLACE_QUERY ?? GOOGLE_PLACE_DEFAULT_QUERY).trim() || GOOGLE_PLACE_DEFAULT_QUERY;

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.reviews",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "es",
      }),
      next: {
        revalidate: 21600,
      },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      places?: Array<{
        displayName?: { text?: string };
        rating?: number;
        userRatingCount?: number;
        googleMapsUri?: string;
        reviews?: Array<{
          rating?: number;
          relativePublishTimeDescription?: string;
          text?: { text?: string };
          authorAttribution?: { displayName?: string };
        }>;
      }>;
    };

    const place = Array.isArray(payload?.places) ? payload.places[0] : undefined;
    if (!place) return null;

    const reviews = Array.isArray(place.reviews)
      ? place.reviews
          .slice(0, 6)
          .map((review) => ({
            authorName: String(review.authorAttribution?.displayName ?? "Usuario de Google").trim() || "Usuario de Google",
            rating: Number.isFinite(review.rating) ? Number(review.rating) : 0,
            text: String(review.text?.text ?? "").trim(),
            relativeDate: formatRelativeDate(review.relativePublishTimeDescription),
          }))
          .filter((review) => review.text.length > 0)
      : [];

    if (!reviews.length) return null;

    return {
      placeName: String(place.displayName?.text ?? "Google Maps").trim() || "Google Maps",
      rating: Number.isFinite(place.rating) ? Number(place.rating) : 0,
      totalRatings: Number.isFinite(place.userRatingCount) ? Number(place.userRatingCount) : 0,
      mapsUrl: String(place.googleMapsUri ?? GOOGLE_REVIEWS_URL).trim() || GOOGLE_REVIEWS_URL,
      reviews,
    };
  } catch {
    return null;
  }
}

function buildFeaturedLocation(zone?: string | null, country?: string | null): string {
  const parts = [zone, country].map((item) => String(item ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : "";
}

function buildFeaturedPriceLabel(price?: number | null): string {
  const numeric = typeof price === "number" && Number.isFinite(price) ? price : 0;
  if (numeric === 0) return "Gratis";
  return `$${numeric.toFixed(2)}`;
}

function hasTourPricing(tour: {
  price?: number | null;
  tourPackages?: unknown;
  priceOptions?: unknown;
}): boolean {
  const hasPackages = Array.isArray(tour.tourPackages)
    && tour.tourPackages.some((pkg) => {
      if (!pkg || typeof pkg !== "object") return false;
      const options = (pkg as { priceOptions?: unknown }).priceOptions;
      return Array.isArray(options) && options.length > 0;
    });
  if (hasPackages) return true;

  const hasLegacyOptions = Array.isArray(tour.priceOptions) && tour.priceOptions.length > 0;
  if (hasLegacyOptions) return true;

  return typeof tour.price === "number" && Number.isFinite(tour.price) && tour.price > 0;
}

function getFeaturedPrincipalPrice(tour: {
  price?: number | null;
  tourPackages?: unknown;
  priceOptions?: unknown;
}): number | null {
  const packageList = Array.isArray(tour.tourPackages)
    ? (tour.tourPackages as Array<{ priceOptions?: Array<{ price?: unknown; isFree?: unknown; isBase?: unknown }> }> )
    : [];

  for (const pkg of packageList) {
    const options = Array.isArray(pkg.priceOptions) ? pkg.priceOptions : [];
    const base = options.find((option) => Boolean(option?.isBase));
    if (base) {
      if (Boolean(base.isFree)) return 0;
      const parsed = Number(base.price);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  const firstPackageWithOptions = packageList.find((pkg) => Array.isArray(pkg.priceOptions) && pkg.priceOptions.length > 0);
  const firstPackageOption = firstPackageWithOptions?.priceOptions?.[0];
  if (firstPackageOption) {
    if (Boolean(firstPackageOption.isFree)) return 0;
    const parsed = Number(firstPackageOption.price);
    if (Number.isFinite(parsed)) return parsed;
  }

  const legacyOptions = Array.isArray(tour.priceOptions)
    ? (tour.priceOptions as Array<{ price?: unknown; isFree?: unknown; isBase?: unknown }>)
    : [];
  const legacyBase = legacyOptions.find((option) => Boolean(option?.isBase));
  if (legacyBase) {
    if (Boolean(legacyBase.isFree)) return 0;
    const parsed = Number(legacyBase.price);
    if (Number.isFinite(parsed)) return parsed;
  }

  if (legacyOptions[0]) {
    if (Boolean(legacyOptions[0].isFree)) return 0;
    const parsed = Number(legacyOptions[0].price);
    if (Number.isFinite(parsed)) return parsed;
  }

  const fallback = typeof tour.price === "number" && Number.isFinite(tour.price) ? tour.price : null;
  return fallback;
}

async function getProviderLogos(): Promise<Array<{ src: string; name: string }>> {
  try {
    const providersDir = path.join(process.cwd(), "uploads", "proveedores");
    const entries = await readdir(providersDir, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => PROVIDER_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((fileName) => ({
        src: `/uploads/proveedores/${encodeURIComponent(fileName)}`,
        name: path.parse(fileName).name.replace(/[-_]+/g, " ").trim() || "Proveedor",
      }));
  } catch {
    return [];
  }
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
  const googlePlaceReviews = await getGooglePlaceReviews();
  const providerLogos = await getProviderLogos();

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
        tourPackages: true,
        priceOptions: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    featuredTours = featuredRaw.map((tour) => {
      const principalPrice = getFeaturedPrincipalPrice(tour);
      return {
        id: tour.id,
        title: tour.title,
        image: Array.isArray(tour.images) && tour.images[0] ? tour.images[0] : TOUR_PLACEHOLDER_IMAGE,
        description: String(tour.description ?? ""),
        categoryName: String(tour.category?.name ?? "Tour"),
        priceLabel: hasTourPricing(tour) && principalPrice !== null ? buildFeaturedPriceLabel(principalPrice) : null,
        location: buildFeaturedLocation(tour.zone, tour.country),
        featured: Boolean(tour.featured),
      };
    });
  } catch {
    featuredTours = [];
  }

  return (
    <div>
      <section className="hero-wrap relative overflow-hidden">
        <div className="hero-slideshow" aria-hidden="true">
          {HERO_SLIDES.map((slide, index) => (
            <div
              key={slide.src}
              className="hero-slide"
              style={{
                backgroundImage: `url(${slide.src})`,
                animationDelay: `${index * 6}s`,
              }}
            />
          ))}
          <div className="hero-overlay" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-24 text-white md:py-32">
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

      {providerLogos.length > 0 ? <ProvidersCarousel logos={providerLogos} /> : null}

      <section className="section-band py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-emerald-700">Opiniones de Google</p>
              <h2 className="mt-2 text-3xl font-extrabold text-emerald-900">Conoce lo que dicen nuestros viajeros</h2>
              {googlePlaceReviews ? (
                <>
                  <p className="mt-3 text-slate-700">
                    Calificacion promedio {ratingAsText(googlePlaceReviews.rating)}/5 basada en {googlePlaceReviews.totalRatings} opiniones para {googlePlaceReviews.placeName}.
                  </p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {googlePlaceReviews.reviews.map((review, index) => (
                      <article key={`${review.authorName}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <p className="text-sm font-extrabold text-emerald-900">{review.authorName}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700">{ratingAsText(review.rating)}/5</p>
                        <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-slate-700">{review.text}</p>
                        {review.relativeDate ? <p className="mt-3 text-xs font-semibold text-slate-500">{review.relativeDate}</p> : null}
                      </article>
                    ))}
                  </div>
                  <div className="mt-6">
                    <Link
                      href={googlePlaceReviews.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-lg bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-500"
                    >
                      Ver mas opiniones en Google
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-slate-700">
                    Para mostrar resenas automaticas en esta pagina, agrega GOOGLE_PLACES_API_KEY en el entorno del servidor.
                  </p>
                  <Link
                    href={GOOGLE_REVIEWS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-block rounded-lg border border-emerald-300 bg-white px-5 py-3 text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    Ver opiniones directamente en Google Maps
                  </Link>
                </>
              )}
            </div>
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
              <h3 className="text-2xl font-extrabold">Contactanos por WhatsApp</h3>
              <p className="mt-3 text-emerald-50">
                Escribenos al +506 6015 9782 y te ayudamos a elegir tour, fechas y metodo de pago en minutos.
              </p>
              <a
                href="https://wa.me/50660159782"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block rounded-lg bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-amber-300"
              >
                Abrir WhatsApp
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold text-emerald-900">Listo para planear tu aventura</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <ContactUnifiedForm className="grid gap-4 md:grid-cols-2" />
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
