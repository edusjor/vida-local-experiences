"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

interface TourPriceOption {
  id: string;
  name: string;
  price: number;
  isFree: boolean;
  isBase?: boolean;
}

interface TourPackage {
  id: string;
  title: string;
  description?: string;
  priceOptions: TourPriceOption[];
}

interface TourAvailabilityConfig {
  mode: "SPECIFIC" | "OPEN";
}

interface Tour {
  id: number;
  title: string;
  slug: string;
  description: string;
  price: number;
  images: string[];
  category: { name: string };
  country?: string;
  zone?: string;
  departurePoint?: string;
  durationDays?: number;
  guideType?: string;
  transport?: string;
  groups?: string;
  story?: string[];
  tourPackages?: TourPackage[];
  availability?: { id: number; date: string; maxPeople: number }[];
  availabilityConfig?: TourAvailabilityConfig;
  includedItems?: string[];
  recommendations?: string[];
  faqs?: Array<{ question: string; answer: string }>;
}

const LOCAL_TOURS_KEY = "toursAdminLocalTours";
const TOUR_PLACEHOLDER_IMAGE = "/tour-placeholder.svg";

interface TourDetailView {
  includes?: string[];
  recommendations?: string[];
  faqs?: Array<{ question: string; answer: string }>;
}

function normalizePriceOptions(items: unknown): TourPriceOption[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const source = item as { id?: unknown; name?: unknown; price?: unknown; isFree?: unknown; isBase?: unknown };
      const id = String(source?.id ?? `price-${index}`).trim();
      const name = String(source?.name ?? "").trim();
      const isFree = Boolean(source?.isFree);
      const isBase = Boolean(source?.isBase);
      const parsedPrice = Number(source?.price);
      const price = isFree ? 0 : parsedPrice;
      return { id, name, isFree, isBase, price };
    })
    .filter((item) => item.id && item.name && (item.isFree || (Number.isFinite(item.price) && item.price > 0)));
}

function formatPriceLabel(option: TourPriceOption): string {
  if (option.isFree || option.price === 0) return "Gratis";
  return `$${option.price.toFixed(2)}`;
}

function getBasePriceOption(options: TourPriceOption[]): TourPriceOption | null {
  return options.find((option) => option.isBase) || null;
}

function hasReservablePricing(raw: Partial<Tour>): boolean {
  const hasPackages = Array.isArray(raw.tourPackages)
    && raw.tourPackages.some((pkg) => Array.isArray(pkg.priceOptions) && pkg.priceOptions.length > 0);
  if (hasPackages) return true;

  const hasLegacyOptions = Array.isArray((raw as { priceOptions?: unknown }).priceOptions)
    && ((raw as { priceOptions?: unknown }).priceOptions as unknown[]).length > 0;
  if (hasLegacyOptions) return true;

  return typeof raw.price === "number" && Number.isFinite(raw.price) && raw.price > 0;
}

function normalizeTourPackages(items: unknown): TourPackage[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const source = item as { id?: unknown; title?: unknown; description?: unknown; priceOptions?: unknown };
      const id = String(source?.id ?? `package-${index}`).trim() || `package-${index}`;
      const title = String(source?.title ?? "").trim();
      const description = String(source?.description ?? "").trim();
      const priceOptions = normalizePriceOptions(source?.priceOptions);

      return { id, title, description, priceOptions };
    })
    .filter((pkg) => pkg.title && pkg.priceOptions.length > 0);
}

function buildNormalizedTourPackages(raw: Partial<Tour>): TourPackage[] {
  const normalizedPackages = normalizeTourPackages(raw.tourPackages);
  if (normalizedPackages.length > 0) return normalizedPackages;

  const legacyOptions = normalizePriceOptions((raw as { priceOptions?: unknown }).priceOptions);
  if (legacyOptions.length > 0) {
    return [
      {
        id: "package-main",
        title: "Paquete principal",
        description: "",
        priceOptions: legacyOptions,
      },
    ];
  }

  return [];
}

function getDurationLabel(days?: number): string {
  const parts: string[] = [];
  if (typeof days === 'number' && days > 0) parts.push(`${days} dia(s)`);
  return parts.length ? parts.join(' ') : 'A confirmar';
}

function slugifyTourValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toMonthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function fromMonthKey(monthKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

function getAvailabilityMode(input: unknown): "OPEN" | "SPECIFIC" {
  // Handle JSON string from database
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return "SPECIFIC";
    }
  }

  if (!parsed || typeof parsed !== "object") return "SPECIFIC";
  
  const source = parsed as { mode?: unknown; availabilityMode?: unknown };
  const rawMode = String(source.mode ?? source.availabilityMode ?? "").trim().toUpperCase();
  return rawMode === "OPEN" ? "OPEN" : "SPECIFIC";
}

function normalizeTour(raw: Partial<Tour> | null | undefined): Tour | null {
  if (!raw?.id || !raw.title) return null;

  const safeImages = Array.isArray(raw.images) && raw.images.length ? raw.images : [TOUR_PLACEHOLDER_IMAGE];

  const hasIncludedItems = Object.prototype.hasOwnProperty.call(raw, "includedItems");
  const hasRecommendations = Object.prototype.hasOwnProperty.call(raw, "recommendations");
  const hasFaqs = Object.prototype.hasOwnProperty.call(raw, "faqs");
  const hasStory = Object.prototype.hasOwnProperty.call(raw, "story");

  return {
    id: raw.id,
    title: raw.title,
    slug: typeof raw.slug === "string" && raw.slug.trim() ? raw.slug : slugifyTourValue(raw.title),
    description: typeof raw.description === "string" ? raw.description : "",
    price: typeof raw.price === "number" ? raw.price : 0,
    images: safeImages,
    category: { name: raw.category?.name ?? "Tour" },
    country: typeof raw.country === "string" ? raw.country : undefined,
    zone: typeof raw.zone === "string" ? raw.zone : undefined,
    departurePoint: typeof raw.departurePoint === "string" ? raw.departurePoint : undefined,
    durationDays: typeof raw.durationDays === "number" ? raw.durationDays : undefined,
    guideType: typeof raw.guideType === "string" ? raw.guideType : undefined,
    transport: typeof raw.transport === "string" ? raw.transport : undefined,
    groups: typeof raw.groups === "string" ? raw.groups : undefined,
    story: hasStory ? (Array.isArray(raw.story) ? raw.story.filter(Boolean) : []) : undefined,
    tourPackages: buildNormalizedTourPackages(raw),
    availability: Array.isArray(raw.availability) ? raw.availability : [],
    availabilityConfig: raw.availabilityConfig !== undefined && raw.availabilityConfig !== null
      ? { mode: getAvailabilityMode(raw.availabilityConfig) }
      : undefined,
    includedItems: hasIncludedItems ? (Array.isArray(raw.includedItems) ? raw.includedItems.filter(Boolean) : []) : undefined,
    recommendations: hasRecommendations ? (Array.isArray(raw.recommendations) ? raw.recommendations.filter(Boolean) : []) : undefined,
    faqs: hasFaqs
      ? Array.isArray(raw.faqs)
        ? raw.faqs
            .map((faq) => ({ question: faq?.question ?? "", answer: faq?.answer ?? "" }))
            .filter((faq) => faq.question.trim())
        : []
      : undefined,
  };
}

function getLocalTourBySlug(slug: string): Tour | null {
  const localTours = safeParse<Partial<Tour>[]>(localStorage.getItem(LOCAL_TOURS_KEY), []);
  const match = localTours.find((tour) => {
    const candidateSlug = typeof tour.slug === "string" && tour.slug.trim() ? tour.slug : slugifyTourValue(String(tour.title ?? ""));
    return candidateSlug === slug;
  });
  return normalizeTour(match);
}

function getLocalTourByRouteParam(routeParam: string): Tour | null {
  const localTours = safeParse<Partial<Tour>[]>(localStorage.getItem(LOCAL_TOURS_KEY), []);
  const match = localTours.find((tour) => {
    const candidateSlug = typeof tour.slug === "string" && tour.slug.trim() ? tour.slug : slugifyTourValue(String(tour.title ?? ""));
    const candidateId = typeof tour.id === "number" ? String(tour.id) : "";
    return candidateSlug === routeParam || candidateId === routeParam;
  });
  return normalizeTour(match);
}

function buildTourRouteParam(tour: Pick<Tour, "id" | "slug">): string {
  const slug = String(tour.slug ?? "").trim();
  if (slug) return slug;
  return String(tour.id);
}

export default function TourDetailPage() {
  const params = useParams();
  const tourSlug = typeof params?.slug === "string" ? params.slug : "";
  const today = new Date();
  const todayDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [tour, setTour] = useState<Tour | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedAvailabilityDate, setSelectedAvailabilityDate] = useState<string>("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => toMonthStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [galleryMainIndex, setGalleryMainIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!tourSlug) {
      setLoading(false);
      return;
    }

    const isNumericRoute = /^\d+$/.test(tourSlug);
    const remoteUrl = isNumericRoute
      ? `/api/tour?id=${encodeURIComponent(tourSlug)}`
      : `/api/tour?slug=${encodeURIComponent(tourSlug)}`;

    fetch(remoteUrl)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        const normalizedRemote = normalizeTour(data);
        if (normalizedRemote) {
          setTour(normalizedRemote);
          return;
        }

        const localTour = getLocalTourByRouteParam(tourSlug);
        if (localTour) {
          setTour(localTour);
          return;
        }

        setTour(null);
      })
      .catch(() => {
        const localTour = getLocalTourByRouteParam(tourSlug);
        if (localTour) {
          setTour(localTour);
          return;
        }

        setTour(null);
      })
      .finally(() => setLoading(false));
  }, [tourSlug]);

  const detail: TourDetailView | null = useMemo(() => {
    if (!tour) return null;

    return {
      includes: tour.includedItems,
      recommendations: tour.recommendations,
      faqs: tour.faqs,
    };
  }, [tour]);

  const isInfoOnlyTour = useMemo(() => !hasReservablePricing(tour ?? {}), [tour]);

  const detailPricePreview = useMemo(() => {
    if (isInfoOnlyTour) return { label: null as string | null };
    if (!detail) return { label: `$${tour?.price.toFixed(2) ?? "0.00"}` };

    const selectedPackage = (tour?.tourPackages || []).find((pkg) => pkg.id === selectedPackageId) || null;
    const activeOptions = selectedPackage?.priceOptions || [];
    if (!activeOptions.length) return { label: `$${tour?.price.toFixed(2) ?? "0.00"}` };

    const baseOption = getBasePriceOption(activeOptions);
    if (baseOption) return { label: formatPriceLabel(baseOption) };

    return { label: `$${tour?.price.toFixed(2) ?? "0.00"}` };
  }, [detail, isInfoOnlyTour, tour?.price, tour?.tourPackages, selectedPackageId]);

  const selectedPackage = useMemo(() => {
    if (!tour?.tourPackages?.length) return null;
    return tour.tourPackages.find((pkg) => pkg.id === selectedPackageId) || tour.tourPackages[0] || null;
  }, [tour?.tourPackages, selectedPackageId]);

  const activePriceOptions = selectedPackage?.priceOptions || [];
  const calendarHasOpenAvailability = tour?.availabilityConfig?.mode === "OPEN";

  const sortedAvailability = useMemo(() => {
    const raw = tour?.availability || [];
    return [...raw].sort((a, b) => a.date.localeCompare(b.date));
  }, [tour?.availability]);

  const availableDateKeys = useMemo(() => {
    return sortedAvailability
      .map((item) => toDateKey(item.date))
      .filter((key) => Boolean(key) && key >= todayDateKey);
  }, [sortedAvailability, todayDateKey]);

  const availableDateSet = useMemo(() => new Set(availableDateKeys), [availableDateKeys]);

  const availableMonthKeys = useMemo(() => {
    return Array.from(new Set(availableDateKeys.map((key) => toMonthKeyFromDateKey(key)))).sort();
  }, [availableDateKeys]);

  const calendarMonthKey = useMemo(() => toMonthKeyFromDate(calendarMonth), [calendarMonth]);

  const previousAvailableMonthKey = useMemo(() => {
    const previous = availableMonthKeys.filter((key) => key < calendarMonthKey);
    return previous.length ? previous[previous.length - 1] : null;
  }, [availableMonthKeys, calendarMonthKey]);

  const nextAvailableMonthKey = useMemo(() => {
    const next = availableMonthKeys.find((key) => key > calendarMonthKey);
    return next ?? null;
  }, [availableMonthKeys, calendarMonthKey]);

  const monthLabel = useMemo(() => {
    return calendarMonth.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  }, [calendarMonth]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;

      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
      const isAvailable = calendarHasOpenAvailability ? key >= todayDateKey : availableDateSet.has(key);
      const isSelected = selectedAvailabilityDate === key;

      return {
        key,
        dayNumber,
        isAvailable,
        isSelected,
      };
    });
  }, [calendarHasOpenAvailability, calendarMonth, availableDateSet, selectedAvailabilityDate, todayDateKey]);

  const hasCalendarAvailability = calendarHasOpenAvailability || availableDateKeys.length > 0;

  useEffect(() => {
    if (!tour?.tourPackages?.length) {
      setSelectedPackageId(null);
      return;
    }

    const exists = tour.tourPackages.some((pkg) => pkg.id === selectedPackageId);
    if (!exists) {
      setSelectedPackageId(tour.tourPackages[0].id);
    }
  }, [tour?.tourPackages, selectedPackageId]);

  useEffect(() => {
    if (calendarHasOpenAvailability) {
      if (!selectedAvailabilityDate || selectedAvailabilityDate < todayDateKey) {
        setSelectedAvailabilityDate(todayDateKey);
      }
      return;
    }

    if (!availableDateKeys.length) {
      setSelectedAvailabilityDate("");
      return;
    }

    const exists = availableDateSet.has(selectedAvailabilityDate);
    if (!exists) {
      const firstDate = availableDateKeys[0];
      setSelectedAvailabilityDate(firstDate);

      const firstDateParsed = new Date(`${firstDate}T00:00:00`);
      if (!Number.isNaN(firstDateParsed.getTime())) {
        setCalendarMonth(toMonthStart(firstDateParsed));
      }
    }
  }, [availableDateKeys, availableDateSet, calendarHasOpenAvailability, selectedAvailabilityDate, todayDateKey]);

  useEffect(() => {
    if (calendarHasOpenAvailability) return;
    if (!availableMonthKeys.length) return;
    if (availableMonthKeys.includes(calendarMonthKey)) return;

    const nextMonth = fromMonthKey(availableMonthKeys[0]);
    if (nextMonth) {
      setCalendarMonth(nextMonth);
    }
  }, [availableMonthKeys, calendarHasOpenAvailability, calendarMonthKey]);

  const imagePool = useMemo(() => {
    if (!tour || !detail) return [];
    const merged = [...tour.images].filter(Boolean);
    return Array.from(new Set(merged));
  }, [detail, tour]);

  const imagesForView = useMemo(() => {
    if (!imagePool.length) return [];
    if (imagePool.length >= 3) return imagePool;
    return [...imagePool, ...imagePool, ...imagePool].slice(0, 3);
  }, [imagePool]);

  useEffect(() => {
    setHeroIndex(0);
    setGalleryMainIndex(0);
    setLightboxIndex(null);
  }, [tourSlug]);

  useEffect(() => {
    if (imagesForView.length <= 1) return;
    const id = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % imagesForView.length);
    }, 4200);
    return () => clearInterval(id);
  }, [imagesForView.length]);

  useEffect(() => {
    if (imagesForView.length <= 1) return;
    const id = setInterval(() => {
      setGalleryMainIndex((prev) => (prev + 1) % imagesForView.length);
    }, 3600);
    return () => clearInterval(id);
  }, [imagesForView.length]);

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mx-auto max-w-md rounded-2xl border border-emerald-200/70 bg-white/90 p-8 text-center shadow-[0_12px_32px_rgba(15,23,42,0.1)]">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" aria-hidden="true" />
          <p className="mt-4 text-base font-bold text-slate-800">Cargando experiencia...</p>
          <p className="mt-1 text-sm text-slate-600">Consultando disponibilidad y detalles del tour.</p>
        </div>
      </section>
    );
  }

  if (!tour || !detail || !imagesForView.length) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <p className="rounded-xl bg-white p-6 text-slate-700 shadow">No encontramos este tour de prueba.</p>
      </section>
    );
  }

  const slideBack = (current: number) => {
    if (!imagesForView.length) return 0;
    return (current - 1 + imagesForView.length) % imagesForView.length;
  };

  const slideNext = (current: number) => {
    if (!imagesForView.length) return 0;
    return (current + 1) % imagesForView.length;
  };

  const sideTopIndex = slideNext(galleryMainIndex);
  const sideBottomIndex = slideNext(sideTopIndex);

  const routeParam = buildTourRouteParam(tour);
  const reserveHref = `/tours/${encodeURIComponent(routeParam)}/reservar${selectedPackage ? `?package=${encodeURIComponent(selectedPackage.id)}${selectedAvailabilityDate ? `&date=${encodeURIComponent(selectedAvailabilityDate)}` : ""}` : selectedAvailabilityDate ? `?date=${encodeURIComponent(selectedAvailabilityDate)}` : ""}`;

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,0.11),transparent_42%),radial-gradient(circle_at_90%_85%,rgba(245,158,11,0.12),transparent_38%),linear-gradient(180deg,#f8fbfa_0%,#ecf3f1_100%)]">
      <div
        className="relative w-full"
        style={{
          backgroundImage: `url(${imagesForView[heroIndex]})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(108deg,rgba(7,20,15,0.78)_0%,rgba(7,20,15,0.56)_46%,rgba(7,20,15,0.36)_100%)]" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:py-11">
          <div className="max-w-3xl p-1 md:p-2">
            <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
              <span className="rounded-full border border-white/35 bg-white/12 px-3 py-1 text-white">{tour.category?.name ?? "Tour"}</span>
              {getDurationLabel(tour.durationDays) && (
                <span className="rounded-full border border-white/35 bg-white/12 px-3 py-1 text-white">{getDurationLabel(tour.durationDays)}</span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold leading-tight text-white md:text-5xl">{tour.title}</h1>
            {[tour.zone, tour.country].filter(Boolean).length > 0 && (
              <p className="mt-3 text-sm text-slate-100">{[tour.zone, tour.country].filter(Boolean).join(", ")}</p>
            )}
            {!isInfoOnlyTour && detailPricePreview.label ? (
              <a
                href={reserveHref}
                className="mt-6 inline-block rounded-xl bg-amber-400 px-6 py-3 font-extrabold text-slate-900 transition hover:bg-amber-300"
              >
                Reservar tour - {detailPricePreview.label}
              </a>
            ) : (
              <p className="mt-6 inline-block rounded-xl border border-white/35 bg-white/12 px-5 py-3 text-sm font-bold text-white">
                Este tour es informativo y no tiene reserva en linea.
              </p>
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-4 z-10">
          <div className="mx-auto flex max-w-6xl justify-end px-4">
            <div className="flex items-center gap-2">
              {imagesForView.map((img, index) => (
                <button
                  key={`${img}-${index}`}
                  type="button"
                  aria-label={`Ir al slide ${index + 1}`}
                  onClick={() => setHeroIndex(index)}
                  className={`h-2.5 w-2.5 rounded-full transition ${heroIndex === index ? "bg-white" : "bg-white/50"}`}
                />
              ))}
            </div>
          </div>
        </div>

      </div>

      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="grid gap-3 md:grid-cols-[1.35fr_1fr]">
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img
                src={imagesForView[galleryMainIndex]}
                alt={tour.title}
                className="h-[420px] w-full cursor-zoom-in object-cover"
                onClick={() => setLightboxIndex(galleryMainIndex)}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-900/65 to-transparent p-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-white/90 px-2 py-1 text-xs font-bold text-slate-800"
                    onClick={() => setGalleryMainIndex((prev) => slideBack(prev))}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-white/90 px-2 py-1 text-xs font-bold text-slate-800"
                    onClick={() => setGalleryMainIndex((prev) => slideNext(prev))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img
                  src={imagesForView[sideTopIndex]}
                  alt={`${tour.title} preview 1`}
                  className="h-[203px] w-full cursor-zoom-in object-cover"
                  onClick={() => setLightboxIndex(sideTopIndex)}
                />
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img
                  src={imagesForView[sideBottomIndex]}
                  alt={`${tour.title} preview 2`}
                  className="h-[203px] w-full cursor-zoom-in object-cover"
                  onClick={() => setLightboxIndex(sideBottomIndex)}
                />
              </div>
            </div>
          </div>

          <article className="mt-7 rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.07)] backdrop-blur-sm">
            <h2 className="text-2xl font-extrabold text-slate-900">Detalles generales</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{tour.description}</p>

            {(getDurationLabel(tour.durationDays) !== "A confirmar" || tour.guideType || tour.transport || tour.groups || [tour.zone, tour.country].filter(Boolean).length > 0 || tour.departurePoint || sortedAvailability[0]) && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {getDurationLabel(tour.durationDays) !== "A confirmar" && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Duracion</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{getDurationLabel(tour.durationDays)}</p>
                  </div>
                )}
                {tour.guideType && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Guia</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{tour.guideType}</p>
                  </div>
                )}
                {tour.transport && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Transporte</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{tour.transport}</p>
                  </div>
                )}
                {tour.groups && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Tamano de grupo</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{tour.groups}</p>
                  </div>
                )}
                {[tour.zone, tour.country].filter(Boolean).length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Ubicacion del tour</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{[tour.zone, tour.country].filter(Boolean).join(", ")}</p>
                  </div>
                )}
                {tour.departurePoint && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Punto de salida</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{tour.departurePoint}</p>
                  </div>
                )}
                {sortedAvailability[0] && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Proxima fecha</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{new Date(sortedAvailability[0].date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            )}
          </article>

          {!isInfoOnlyTour && (Boolean(tour.tourPackages?.length) || Boolean(activePriceOptions.length)) && (
            <article className="mt-7 rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.07)] backdrop-blur-sm">
              <h3 className="text-xl font-extrabold text-slate-900">Paquetes y precios</h3>

              {Boolean(tour.tourPackages?.length) && (
                <>
                  <p className="mt-1 text-sm text-slate-600">Selecciona un paquete para ver sus precios.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {tour.tourPackages?.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`rounded-xl border px-3 py-3 text-left transition ${selectedPackage?.id === pkg.id ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-300"}`}
                      >
                        <p className="text-sm font-extrabold text-slate-900">{pkg.title}</p>
                        {pkg.description && <p className="mt-1 text-xs text-slate-600">{pkg.description}</p>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {Boolean(activePriceOptions.length) && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Precios {selectedPackage ? `- ${selectedPackage.title}` : "- Paquete principal"}
                  </h4>
                  <div className="mt-2 space-y-1">
                    {activePriceOptions.map((option) => (
                      <div key={option.id} className="flex items-center justify-between rounded-lg px-2 py-1.5">
                        <span className="text-sm font-semibold text-slate-600">{option.name}</span>
                        <span className={`text-sm font-extrabold ${option.isFree || option.price === 0 ? "text-emerald-700" : "text-slate-900"}`}>
                          {formatPriceLabel(option)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          )}

          {Boolean((detail.includes?.length || 0) + (detail.recommendations?.length || 0)) && (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {Boolean(detail.includes?.length) && (
                <article className="rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.07)] backdrop-blur-sm">
                  <h3 className="text-xl font-extrabold text-slate-900">Lo que esta incluido</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700 marker:text-emerald-700">
                    {detail.includes?.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}

              {Boolean(detail.recommendations?.length) && (
                <article className="rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.07)] backdrop-blur-sm">
                  <h3 className="text-xl font-extrabold text-slate-900">Recomendaciones</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700 marker:text-emerald-700">
                    {detail.recommendations?.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}
            </div>
          )}

          {Boolean(detail.faqs?.length) && (
            <article className="mt-7 rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.07)] backdrop-blur-sm">
              <h3 className="text-xl font-extrabold text-slate-900">Preguntas frecuentes</h3>
              <div className="mt-3 space-y-2">
                {detail.faqs?.map((faq) => (
                  <details key={faq.question} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer font-semibold text-slate-900">{faq.question}</summary>
                    <p className="mt-2 text-slate-700">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </article>
          )}
        </div>

        <aside className="self-start rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.09)] backdrop-blur-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {!isInfoOnlyTour && detailPricePreview.label ? (
            <>
              <p className="text-4xl font-black text-emerald-800">{detailPricePreview.label}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Precio segun tipo seleccionado</p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-extrabold text-slate-800">Consulta disponibilidad</p>
                <p className="mt-1 text-xs text-slate-600">Selecciona en el calendario una fecha disponible.</p>

            {hasCalendarAvailability ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarHasOpenAvailability) {
                        setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                        return;
                      }

                      if (!previousAvailableMonthKey) return;
                      const month = fromMonthKey(previousAvailableMonthKey);
                      if (month) setCalendarMonth(month);
                    }}
                    disabled={!calendarHasOpenAvailability && !previousAvailableMonthKey}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <p className="text-sm font-bold capitalize text-slate-800">{monthLabel}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarHasOpenAvailability) {
                        setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                        return;
                      }

                      if (!nextAvailableMonthKey) return;
                      const month = fromMonthKey(nextAvailableMonthKey);
                      if (month) setCalendarMonth(month);
                    }}
                    disabled={!calendarHasOpenAvailability && !nextAvailableMonthKey}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                    <span key={day} className="py-1">
                      {day}
                    </span>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {calendarCells.map((cell, index) => {
                    if (!cell) {
                      return <span key={`empty-${index}`} className="h-8 rounded-md" aria-hidden="true" />;
                    }

                    const baseClass = "h-8 rounded-md text-xs font-bold transition";
                    const className = cell.isSelected
                      ? `${baseClass} border border-emerald-400 bg-emerald-500 text-white`
                      : cell.isAvailable
                        ? `${baseClass} border border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-200`
                        : `${baseClass} border border-slate-200 bg-white text-slate-300 cursor-not-allowed`;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        disabled={!cell.isAvailable}
                        onClick={() => setSelectedAvailabilityDate(cell.key)}
                        className={className}
                        aria-label={`Dia ${cell.dayNumber}`}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2 text-[11px] text-slate-500">
                  {calendarHasOpenAvailability
                    ? "Modo abierto: puedes seleccionar cualquier fecha desde hoy."
                    : "Solo se habilitan dias con disponibilidad."}
                </p>
              </>
            ) : (
              <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">Sin fechas disponibles por ahora.</p>
            )}
              </div>

              <a
                href={reserveHref}
                className="mt-5 block rounded-xl bg-emerald-700 px-5 py-3 text-center font-extrabold text-white transition hover:bg-emerald-600"
              >
                Reservar ahora
              </a>
              <p className="mt-3 text-xs text-slate-500">Reserva flexible y confirmacion por correo en minutos.</p>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-extrabold text-slate-800">Tour informativo</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Este tour no tiene precios configurados, por eso no se habilita reserva en linea.
              </p>
            </div>
          )}
        </aside>
      </div>
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative w-full max-w-6xl rounded-2xl bg-slate-950 p-4" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full bg-white text-lg font-bold leading-none text-slate-900"
              aria-label="Cerrar imagen"
            >
              X
            </button>

            <button
              type="button"
              onClick={() => setLightboxIndex(slideBack(lightboxIndex))}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 px-3 py-2 text-2xl font-bold leading-none text-white transition hover:bg-black/65"
              aria-label="Imagen anterior"
            >
              &lt;
            </button>

            <button
              type="button"
              onClick={() => setLightboxIndex(slideNext(lightboxIndex))}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 px-3 py-2 text-2xl font-bold leading-none text-white transition hover:bg-black/65"
              aria-label="Imagen siguiente"
            >
              &gt;
            </button>

            <img
              src={imagesForView[lightboxIndex]}
              alt={tour.title}
              className="max-h-[80vh] w-full rounded-xl object-contain"
            />

            <p className="mt-4 text-center text-sm text-slate-300">
              {lightboxIndex + 1} / {imagesForView.length}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
