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

function getEffectiveTourPrice(tour: Tour): number {
  const firstPackageWithPrices = Array.isArray(tour.tourPackages)
    ? tour.tourPackages.find((pkg) => Array.isArray(pkg.priceOptions) && pkg.priceOptions.length > 0)
    : null;

  if (firstPackageWithPrices) {
    const baseFromPackage = getBasePriceOption(firstPackageWithPrices.priceOptions) || firstPackageWithPrices.priceOptions[0] || null;
    if (baseFromPackage) {
      if (baseFromPackage.isFree || baseFromPackage.price === 0) return 0;
      if (Number.isFinite(baseFromPackage.price)) return baseFromPackage.price;
    }
  }

  const baseOption = getBasePriceOption(tour.priceOptions);
  if (!baseOption) return tour.price;
  if (baseOption.isFree || baseOption.price === 0) return 0;
  return Number.isFinite(baseOption.price) ? baseOption.price : tour.price;
}

function getTourPriceLabel(tour: Tour): string {
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

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(defaultFilterConfig);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
    const prices = tours.map((t) => getEffectiveTourPrice(t)).filter((v) => Number.isFinite(v));
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
        const effectivePrice = getEffectiveTourPrice(tour);
        if (effectivePrice < priceMin || effectivePrice > priceMax) return false;
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

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 px-6 py-8 text-white">
        <h2 className="text-4xl font-extrabold">Explora nuestros tours</h2>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[290px_1fr]">
        <aside className="h-fit rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 p-5 shadow-xl shadow-slate-300/40 lg:sticky lg:top-6">
          <h3 className="text-lg font-extrabold text-slate-900">Filtros</h3>

          <div className="mt-4 space-y-4">
            {filterConfig.country && (
              <div className="pb-3 border-b border-slate-200/80 last:border-b-0">
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
              <div className="pb-3 border-b border-slate-200/80 last:border-b-0">
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
              <div className="pb-3 border-b border-slate-200/80 last:border-b-0">
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
              <div className="pb-3 border-b border-slate-200/80 last:border-b-0">
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
              <div className="pb-3 border-b border-slate-200/80 last:border-b-0">
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
              <div className="pb-3 border-b border-slate-200/80 last:border-b-0">
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
              <div className="pb-3 border-b border-slate-200/80 last:border-b-0">
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
        </aside>

        <div>
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
                  <h3 className="mt-1 line-clamp-3 min-h-[6.25rem] text-2xl font-extrabold leading-tight text-slate-900">{tour.title}</h3>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-slate-600">{tour.description}</p>

                  <div className="mt-3 min-h-10">
                    {locationLabel && (
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {locationLabel}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <span className="text-3xl font-black text-emerald-600">{getTourPriceLabel(tour)}</span>
                    <Link
                      href={`/tours/${tour.slug}`}
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
    </section>
  );
}
