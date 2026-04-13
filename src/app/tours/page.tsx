"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

interface Tour {
  id: number;
  title: string;
  slug: string;
  description: string;
  price: number;
  priceOptions?: TourPriceOption[];
  tourPackages?: TourPackage[];
  images: string[];
  category: { id: number; name: string };
  status?: "ACTIVO" | "NO_ACTIVO" | "BORRADOR";
  isDeleted?: boolean;
  country?: string;
  zone?: string;
  durationDays?: number;
  activityType?: string;
  difficulty?: string;
  featured?: boolean;
}

interface Category {
  id: number;
  name: string;
}

interface FilterConfig {
  country: boolean;
  zone: boolean;
  price: boolean;
  durationDays: boolean;
  activityType: boolean;
  category: boolean;
  difficulty: boolean;
  featured: boolean;
}

const LOCAL_TOURS_KEY = "toursAdminLocalTours";
const FILTER_CONFIG_KEY = "toursFilterConfig";
const TOUR_PLACEHOLDER_IMAGE = "/tour-placeholder.svg";

const defaultFilterConfig: FilterConfig = {
  country: true,
  zone: true,
  price: true,
  durationDays: true,
  activityType: true,
  category: true,
  difficulty: true,
  featured: true,
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type RangeSliderProps = {
  minLimit: number;
  maxLimit: number;
  valueMin: number;
  valueMax: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  formatLabel?: (value: number) => string;
};

function RangeSlider({
  minLimit,
  maxLimit,
  valueMin,
  valueMax,
  onMinChange,
  onMaxChange,
  formatLabel,
}: RangeSliderProps) {
  const parseValue = (raw: string) => Number(raw);
  const getLabel = formatLabel ?? ((value: number) => `${value}`);
  const range = Math.max(1, maxLimit - minLimit);
  const leftPercent = ((valueMin - minLimit) / range) * 100;
  const rightPercent = ((valueMax - minLimit) / range) * 100;

  return (
    <div>
      <div className="relative h-10">
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-100" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-500"
          style={{ left: `${leftPercent}%`, width: `${Math.max(0, rightPercent - leftPercent)}%` }}
        />
        <input
          type="range"
          min={minLimit}
          max={maxLimit}
          step={1}
          value={valueMin}
          onChange={(e) => {
            const next = parseValue(e.target.value);
            onMinChange(Math.min(next, valueMax));
          }}
          className="dual-range-input absolute left-0 top-0 z-20 h-full w-full"
        />
        <input
          type="range"
          min={minLimit}
          max={maxLimit}
          step={1}
          value={valueMax}
          onChange={(e) => {
            const next = parseValue(e.target.value);
            onMaxChange(Math.max(next, valueMin));
          }}
          className="dual-range-input absolute left-0 top-0 z-30 h-full w-full"
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs font-bold text-slate-600">
        <span>{getLabel(valueMin)}</span>
        <span>{getLabel(valueMax)}</span>
      </div>
    </div>
  );
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getBasePriceOption(options: TourPriceOption[] | undefined): TourPriceOption | null {
  if (!Array.isArray(options)) return null;
  return options.find((option) => option.isBase) || null;
}

function normalizeOptionPrice(option: TourPriceOption): number {
  if (option.isFree || option.price === 0) return 0;
  return Number.isFinite(option.price) ? option.price : NaN;
}

function getReservableOptionPrices(tour: Tour): number[] {
  const packagePrices = Array.isArray(tour.tourPackages)
    ? tour.tourPackages.flatMap((pkg) =>
      Array.isArray(pkg.priceOptions)
        ? pkg.priceOptions.map((option) => normalizeOptionPrice(option)).filter((value) => Number.isFinite(value))
        : [],
    )
    : [];

  if (packagePrices.length > 0) return packagePrices;

  const legacyOptionPrices = Array.isArray(tour.priceOptions)
    ? tour.priceOptions.map((option) => normalizeOptionPrice(option)).filter((value) => Number.isFinite(value))
    : [];

  if (legacyOptionPrices.length > 0) return legacyOptionPrices;

  if (typeof tour.price === "number" && Number.isFinite(tour.price) && tour.price > 0) {
    return [tour.price];
  }

  return [];
}

function hasReservablePricing(tour: Tour): boolean {
  const hasPackagePricing = Array.isArray(tour.tourPackages)
    && tour.tourPackages.some((pkg) => Array.isArray(pkg.priceOptions) && pkg.priceOptions.length > 0);
  if (hasPackagePricing) return true;

  const hasLegacyPricing = Array.isArray(tour.priceOptions) && tour.priceOptions.length > 0;
  if (hasLegacyPricing) return true;

  return typeof tour.price === "number" && Number.isFinite(tour.price) && tour.price > 0;
}

function getEffectiveTourPrice(tour: Tour): number {
  const allPrices = getReservableOptionPrices(tour);
  if (allPrices.length === 0) return tour.price;
  return Math.min(...allPrices);
}

function getTourPriceLabel(tour: Tour): string | null {
  if (!hasReservablePricing(tour)) return null;
  const effectivePrice = getEffectiveTourPrice(tour);
  if (effectivePrice === 0) return "Gratis";
  return `$${effectivePrice.toFixed(2)}`;
}

function getTourLocationLabel(tour: Tour): string {
  const location = [tour.zone, tour.country]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  if (!location.length) return "";
  return location.join(", ");
}

function getTourRouteParam(tour: Tour): string {
  const slug = String(tour.slug ?? "").trim();
  if (slug) return slug;
  return String(tour.id);
}

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(defaultFilterConfig);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("Todos");
  const [selectedZone, setSelectedZone] = useState("Todos");
  const [selectedActivity, setSelectedActivity] = useState("Todos");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedDifficulty, setSelectedDifficulty] = useState("Todos");
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [daysMin, setDaysMin] = useState(0);
  const [daysMax, setDaysMax] = useState(0);

  const reloadToursData = () => {
    const localConfig = safeParse<FilterConfig>(localStorage.getItem(FILTER_CONFIG_KEY), defaultFilterConfig);
    setFilterConfig({ ...defaultFilterConfig, ...localConfig });

    const localTours = safeParse<Tour[]>(localStorage.getItem(LOCAL_TOURS_KEY), []);

    Promise.all([fetch("/api/tours").then((res) => res.json()), fetch("/api/categories").then((res) => res.json())])
      .then(([tourData, categoryData]) => {
        const remoteTours = Array.isArray(tourData) ? (tourData as Tour[]) : [];

        const remoteCategories = Array.isArray(categoryData) ? (categoryData as Category[]) : [];
        const categoriesFromTours = remoteTours
          .map((item) => item.category)
          .filter(Boolean)
          .reduce<Category[]>((acc, category) => {
            if (!acc.find((c) => c.id === category.id)) acc.push(category);
            return acc;
          }, []);

        setTours(remoteTours);
        setCategories(
          [...remoteCategories, ...categoriesFromTours].filter((item, index, arr) => arr.findIndex((a) => a.id === item.id) === index),
        );
        setLoadError("");

        localStorage.setItem(LOCAL_TOURS_KEY, JSON.stringify(remoteTours));
      })
      .catch(() => {
        setTours(localTours);
        setCategories([]);
        setLoadError("No se pudieron cargar tours desde el servidor. Verifica la conexion con la base de datos.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reloadToursData();

    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_TOURS_KEY || event.key === FILTER_CONFIG_KEY || event.key === "toursDataVersion") {
        reloadToursData();
      }
    };

    const onCustomUpdate = () => reloadToursData();
    const onFocus = () => reloadToursData();

    window.addEventListener("storage", onStorage);
    window.addEventListener("tours-data-updated", onCustomUpdate);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tours-data-updated", onCustomUpdate);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const numericRanges = useMemo(() => {
    const prices = tours
      .filter((tour) => !tour.isDeleted && (tour.status ?? "BORRADOR") === "ACTIVO")
      .flatMap((tour) => getReservableOptionPrices(tour));
    const dayValues = tours.map((t) => t.durationDays ?? 0).filter((v) => v > 0);

    return {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      minDays: dayValues.length ? Math.min(...dayValues) : 0,
      maxDays: dayValues.length ? Math.max(...dayValues) : 0,
    };
  }, [tours]);

  useEffect(() => {
    setPriceMin(numericRanges.minPrice);
    setPriceMax(numericRanges.maxPrice);
    setDaysMin(numericRanges.minDays);
    setDaysMax(numericRanges.maxDays);
  }, [numericRanges]);

  useEffect(() => {
    if (!isMobileFiltersOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileFiltersOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileFiltersOpen]);

  const countries = useMemo(() => {
    const values = tours.map((tour) => tour.country).filter(Boolean) as string[];
    return ["Todos", ...Array.from(new Set(values))];
  }, [tours]);

  const activities = useMemo(() => {
    const values = tours.map((tour) => tour.activityType).filter(Boolean) as string[];
    return ["Todos", ...Array.from(new Set(values)), "Sin actividad definida"];
  }, [tours]);

  const zones = useMemo(() => {
    const values = tours
      .filter((tour) => selectedCountry === "Todos" || tour.country === selectedCountry)
      .map((tour) => tour.zone)
      .filter(Boolean) as string[];

    return ["Todos", ...Array.from(new Set(values)), "Sin zona definida"];
  }, [tours, selectedCountry]);

  useEffect(() => {
    if (!zones.includes(selectedZone)) {
      setSelectedZone("Todos");
    }
  }, [zones, selectedZone]);

  const difficulties = useMemo(() => {
    const values = tours.map((tour) => tour.difficulty).filter(Boolean) as string[];
    return ["Todos", ...Array.from(new Set(values)), "Sin dificultad"];
  }, [tours]);

  const categoryOptions = useMemo(() => ["Todos", ...categories.map((item) => item.name)], [categories]);

  const filteredTours = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return tours.filter((tour) => {
      const normalizedStatus = tour.status ?? "BORRADOR";

      if (tour.isDeleted) return false;
      if (normalizedStatus !== "ACTIVO") return false;

      if (search) {
        const haystack = `${tour.title} ${tour.description} ${tour.country ?? ""} ${tour.zone ?? ""} ${tour.activityType ?? ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (filterConfig.country && selectedCountry !== "Todos" && tour.country !== selectedCountry) return false;

      if (filterConfig.zone && selectedZone !== "Todos") {
        if (selectedZone === "Sin zona definida") {
          if (tour.zone) return false;
        } else if (tour.zone !== selectedZone) {
          return false;
        }
      }

      if (filterConfig.activityType && selectedActivity !== "Todos") {
        if (selectedActivity === "Sin actividad definida") {
          if (tour.activityType) return false;
        } else if (tour.activityType !== selectedActivity) {
          return false;
        }
      }

      if (filterConfig.category && selectedCategory !== "Todos" && tour.category?.name !== selectedCategory) return false;

      if (filterConfig.difficulty && selectedDifficulty !== "Todos") {
        if (selectedDifficulty === "Sin dificultad") {
          if (tour.difficulty) return false;
        } else if (tour.difficulty !== selectedDifficulty) {
          return false;
        }
      }

      if (filterConfig.featured && onlyFeatured && !tour.featured) return false;

      if (filterConfig.price) {
        if (hasReservablePricing(tour)) {
          const optionPrices = getReservableOptionPrices(tour);
          const matchesPriceRange = optionPrices.some((value) => value >= priceMin && value <= priceMax);
          if (!matchesPriceRange) return false;
        }
      }

      if (filterConfig.durationDays && tour.durationDays) {
        if (tour.durationDays < daysMin || tour.durationDays > daysMax) return false;
      }

      return true;
    });
  }, [
    tours,
    searchText,
    filterConfig,
    selectedCountry,
    selectedZone,
    selectedActivity,
    selectedCategory,
    selectedDifficulty,
    onlyFeatured,
    priceMin,
    priceMax,
    daysMin,
    daysMax,
  ]);

  const clearFilters = () => {
    setSearchText("");
    setSelectedCountry("Todos");
    setSelectedZone("Todos");
    setSelectedActivity("Todos");
    setSelectedCategory("Todos");
    setSelectedDifficulty("Todos");
    setOnlyFeatured(false);
    setPriceMin(numericRanges.minPrice);
    setPriceMax(numericRanges.maxPrice);
    setDaysMin(numericRanges.minDays);
    setDaysMax(numericRanges.maxDays);
  };

  const filtersControls = (
    <div className="mt-4 space-y-4">
      {filterConfig.country && (
        <div className="border-b border-slate-200/80 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Pais</p>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            {countries.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.zone && (
        <div className="border-b border-slate-200/80 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Zona</p>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            {zones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.category && (
        <div className="border-b border-slate-200/80 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Categoria</p>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            {categoryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.activityType && (
        <div className="border-b border-slate-200/80 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Actividad</p>
          <select
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            {activities.map((activity) => (
              <option key={activity}>{activity}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.difficulty && (
        <div className="border-b border-slate-200/80 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Dificultad</p>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            {difficulties.map((difficulty) => (
              <option key={difficulty}>{difficulty}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.price && (
        <div className="border-b border-slate-200/80 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Precio</p>
          <RangeSlider
            minLimit={numericRanges.minPrice}
            maxLimit={numericRanges.maxPrice}
            valueMin={priceMin}
            valueMax={priceMax}
            onMinChange={setPriceMin}
            onMaxChange={setPriceMax}
            formatLabel={formatUsd}
          />
        </div>
      )}

      {filterConfig.durationDays && (
        <div className="border-b border-slate-200/80 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Duracion en dias</p>
          <RangeSlider
            minLimit={numericRanges.minDays}
            maxLimit={numericRanges.maxDays}
            valueMin={daysMin}
            valueMax={daysMax}
            onMinChange={setDaysMin}
            onMaxChange={setDaysMax}
            formatLabel={(value) => `${value} dia(s)`}
          />
        </div>
      )}

      {filterConfig.featured && (
        <label className="flex items-center gap-2 pb-1 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={onlyFeatured} onChange={(e) => setOnlyFeatured(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Solo destacados
        </label>
      )}
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 px-6 py-8 text-white">
        <h2 className="text-4xl font-extrabold">Explora nuestros tours</h2>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[290px_1fr]">
        <aside className="sticky top-6 hidden h-fit rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 p-5 shadow-xl shadow-slate-300/40 lg:block">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-slate-900">Filtros</h3>
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-bold text-rose-600 transition hover:text-rose-700"
            >
              Limpiar
            </button>
          </div>
          {filtersControls}
        </aside>

        <div>
          <div className="mb-4 lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500"
            >
              <span>Filtros</span>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/40 text-[11px]">+</span>
            </button>
          </div>

          {loadError && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{loadError}</p>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar tour por nombre, descripcion, pais o actividad"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          {loading && <p className="mt-6 text-slate-500">Cargando tours...</p>}

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredTours.map((tour) => (
              (() => {
                const locationLabel = getTourLocationLabel(tour);
                const priceLabel = getTourPriceLabel(tour);
                return (
              <article key={tour.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-300/40">
                <div className="relative">
                  <img src={tour.images?.[0] || TOUR_PLACEHOLDER_IMAGE} alt={tour.title} className="h-44 w-full object-cover" />
                  {tour.featured && (
                    <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-900">Destacado</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">{tour.category?.name ?? "Tour"}</p>
                  <h3 className="mt-1 text-base font-bold leading-snug text-slate-900">{tour.title}</h3>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-slate-600">{tour.description}</p>

                  <div className="mt-3 min-h-10">
                    {locationLabel && (
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {locationLabel}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    {priceLabel ? (
                      <span className="text-3xl font-black text-emerald-600">{priceLabel}</span>
                    ) : (
                      <span className="text-sm font-bold uppercase tracking-wide text-slate-400">Solo informativo</span>
                    )}
                    <Link
                      href={`/tours/${encodeURIComponent(getTourRouteParam(tour))}`}
                      className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-amber-300"
                    >
                      Ver detalles
                    </Link>
                  </div>
                </div>
              </article>
                );
              })()
            ))}
          </div>

          {!loading && filteredTours.length === 0 && (
            <p className="mt-6 rounded-xl bg-white p-4 text-slate-600 shadow">No hay tours que coincidan con los filtros seleccionados.</p>
          )}
        </div>
      </div>

      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Panel de filtros">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={() => setIsMobileFiltersOpen(false)}
            aria-label="Cerrar panel de filtros"
          />

          <div className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white p-5 shadow-2xl shadow-black/30">
            <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h3 className="text-xl font-extrabold text-slate-900">Filtrar por</h3>
              <div className="flex items-center gap-4">
                <button type="button" onClick={clearFilters} className="text-sm font-bold text-rose-500">
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-xl leading-none text-slate-700"
                  aria-label="Cerrar filtros"
                >
                  ×
                </button>
              </div>
            </div>

            {filtersControls}

            <div className="sticky bottom-0 -mx-5 mt-6 border-t border-slate-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
