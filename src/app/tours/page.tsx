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

type SortOption = "featured" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function FiltersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
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
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--brand-gold)]"
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
      <div className="mt-1 flex items-center justify-between text-xs font-bold text-slate-300">
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
  if (Array.isArray(tour.tourPackages)) {
    for (const pkg of tour.tourPackages) {
      const baseOption = Array.isArray(pkg.priceOptions)
        ? pkg.priceOptions.find((option) => option.isBase)
        : null;
      if (baseOption) return normalizeOptionPrice(baseOption);
    }

    const firstPackageWithOptions = tour.tourPackages.find((pkg) => Array.isArray(pkg.priceOptions) && pkg.priceOptions.length > 0);
    if (firstPackageWithOptions?.priceOptions?.[0]) {
      return normalizeOptionPrice(firstPackageWithOptions.priceOptions[0]);
    }
  }

  const legacyBase = getBasePriceOption(tour.priceOptions);
  if (legacyBase) return normalizeOptionPrice(legacyBase);
  if (Array.isArray(tour.priceOptions) && tour.priceOptions[0]) {
    return normalizeOptionPrice(tour.priceOptions[0]);
  }

  return tour.price;
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

function getTourCardTag(tour: Tour): string {
  const activityType = String(tour.activityType ?? "").trim();
  if (activityType) return activityType;

  const difficulty = String(tour.difficulty ?? "").trim();
  if (difficulty) return difficulty;

  if (typeof tour.durationDays === "number" && Number.isFinite(tour.durationDays) && tour.durationDays > 0) {
    return tour.durationDays === 1 ? "1 dia" : `${tour.durationDays} dias`;
  }

  return "Privado";
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
  const [searchDraft, setSearchDraft] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("featured");
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

  const sortedTours = useMemo(() => {
    const items = [...filteredTours];

    const compareTitle = (left: Tour, right: Tour) => left.title.localeCompare(right.title, "es", { sensitivity: "base" });
    const getSortablePrice = (tour: Tour): number | null => {
      if (!hasReservablePricing(tour)) return null;
      const effectivePrice = getEffectiveTourPrice(tour);
      return Number.isFinite(effectivePrice) ? effectivePrice : null;
    };

    switch (sortOption) {
      case "price-asc":
        return items.sort((left, right) => {
          const leftPrice = getSortablePrice(left);
          const rightPrice = getSortablePrice(right);
          if (leftPrice === null && rightPrice === null) return compareTitle(left, right);
          if (leftPrice === null) return 1;
          if (rightPrice === null) return -1;
          return leftPrice - rightPrice || compareTitle(left, right);
        });
      case "price-desc":
        return items.sort((left, right) => {
          const leftPrice = getSortablePrice(left);
          const rightPrice = getSortablePrice(right);
          if (leftPrice === null && rightPrice === null) return compareTitle(left, right);
          if (leftPrice === null) return 1;
          if (rightPrice === null) return -1;
          return rightPrice - leftPrice || compareTitle(left, right);
        });
      case "name-asc":
        return items.sort(compareTitle);
      case "name-desc":
        return items.sort((left, right) => compareTitle(right, left));
      case "featured":
      default:
        return items.sort((left, right) => {
          if (left.featured !== right.featured) return left.featured ? -1 : 1;
          return compareTitle(left, right);
        });
    }
  }, [filteredTours, sortOption]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCountry !== "Todos") count += 1;
    if (selectedZone !== "Todos") count += 1;
    if (selectedActivity !== "Todos") count += 1;
    if (selectedCategory !== "Todos") count += 1;
    if (selectedDifficulty !== "Todos") count += 1;
    if (onlyFeatured) count += 1;
    if (filterConfig.price && (priceMin !== numericRanges.minPrice || priceMax !== numericRanges.maxPrice)) count += 1;
    if (filterConfig.durationDays && (daysMin !== numericRanges.minDays || daysMax !== numericRanges.maxDays)) count += 1;
    return count;
  }, [
    selectedCountry,
    selectedZone,
    selectedActivity,
    selectedCategory,
    selectedDifficulty,
    onlyFeatured,
    filterConfig.price,
    filterConfig.durationDays,
    priceMin,
    priceMax,
    daysMin,
    daysMax,
    numericRanges.minPrice,
    numericRanges.maxPrice,
    numericRanges.minDays,
    numericRanges.maxDays,
  ]);

  const clearFilters = () => {
    setSearchText("");
    setSearchDraft("");
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
        <div className="border-b border-white/10 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Country</p>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#171c24] px-3 py-2.5 text-sm font-semibold text-slate-100 shadow-sm transition focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(250,178,79,0.12)]"
          >
            {countries.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.zone && (
        <div className="border-b border-white/10 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Area</p>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#171c24] px-3 py-2.5 text-sm font-semibold text-slate-100 shadow-sm transition focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(250,178,79,0.12)]"
          >
            {zones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.category && (
        <div className="border-b border-white/10 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Category</p>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#171c24] px-3 py-2.5 text-sm font-semibold text-slate-100 shadow-sm transition focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(250,178,79,0.12)]"
          >
            {categoryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.activityType && (
        <div className="border-b border-white/10 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Activity</p>
          <select
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#171c24] px-3 py-2.5 text-sm font-semibold text-slate-100 shadow-sm transition focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(250,178,79,0.12)]"
          >
            {activities.map((activity) => (
              <option key={activity}>{activity}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.difficulty && (
        <div className="border-b border-white/10 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Difficulty</p>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#171c24] px-3 py-2.5 text-sm font-semibold text-slate-100 shadow-sm transition focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(250,178,79,0.12)]"
          >
            {difficulties.map((difficulty) => (
              <option key={difficulty}>{difficulty}</option>
            ))}
          </select>
        </div>
      )}

      {filterConfig.price && (
        <div className="border-b border-white/10 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Price</p>
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
        <div className="border-b border-white/10 pb-3 last:border-b-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Duration (days)</p>
          <RangeSlider
            minLimit={numericRanges.minDays}
            maxLimit={numericRanges.maxDays}
            valueMin={daysMin}
            valueMax={daysMax}
            onMinChange={setDaysMin}
            onMaxChange={setDaysMax}
            formatLabel={(value) => `${value} day(s)`}
          />
        </div>
      )}

      {filterConfig.featured && (
        <label className="flex items-center gap-2 pb-1 text-sm font-semibold text-slate-200">
          <input type="checkbox" checked={onlyFeatured} onChange={(e) => setOnlyFeatured(e.target.checked)} className="h-4 w-4 rounded border-white/20 accent-[var(--brand-gold)]" />
          Featured only
        </label>
      )}
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#171c24] shadow-[0_28px_72px_rgba(0,0,0,0.28)]">
        <img
          src="https://images.unsplash.com/photo-1509233725247-49e657c54213?auto=format&fit=crop&w=1800&q=80"
          alt="Costa Rica landscape"
          className="absolute inset-0 h-full w-full object-cover opacity-28"
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(7,10,15,0.92)_0%,rgba(7,10,15,0.82)_45%,rgba(7,10,15,0.74)_100%)]" />
        <div className="relative z-10 px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-gold)]">All Tours</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-extrabold text-white md:text-5xl">Explore our experiences</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200 md:text-base">
            Discover private, local, and authentic experiences in Manuel Antonio, Dominical, and Uvita with a more intentional pace.
          </p>

          <form
            className="mt-8 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchText(searchDraft.trim());
            }}
          >
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#202630]/92 px-4 py-3 text-slate-300 shadow-lg shadow-black/10">
              <SearchIcon />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search by name, description, country, or activity"
                className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              className="rounded-2xl bg-[var(--brand-gold)] px-5 py-3 text-sm font-extrabold text-[#11151c] transition hover:brightness-105"
            >
              Search
            </button>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_250px]">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#202630]/92 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#26303d]"
              >
                <FiltersIcon />
                <span>All filters</span>
                {activeFiltersCount > 0 ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--brand-gold)] px-2 py-0.5 text-[11px] font-black text-[#11151c]">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </button>

              <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#202630]/92 px-4 py-3 text-sm font-bold text-slate-300">
                <span className="whitespace-nowrap text-slate-400">Sort by</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-[#1b2230] px-2 py-1 font-extrabold text-white focus:border-[var(--brand-gold)] focus:outline-none"
                >
                  <option value="featured" className="bg-[#1b2230] text-white">Featured</option>
                  <option value="price-asc" className="bg-[#1b2230] text-white">Price: low to high</option>
                  <option value="price-desc" className="bg-[#1b2230] text-white">Price: high to low</option>
                  <option value="name-asc" className="bg-[#1b2230] text-white">Name: A-Z</option>
                  <option value="name-desc" className="bg-[#1b2230] text-white">Name: Z-A</option>
                </select>
              </label>
            </div>
          </form>
        </div>
      </div>

      <div className="mt-6">
        {loadError && (
          <p className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{loadError}</p>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--brand-gold)]">Results</p>
            <p className="mt-1 text-2xl font-black text-white">{sortedTours.length} experiences</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {searchText ? (
              <span className="rounded-full border border-white/10 bg-[#202630]/92 px-3 py-1.5 font-semibold text-slate-200">
                Searching: {searchText}
              </span>
            ) : null}
            {activeFiltersCount > 0 ? (
              <span className="rounded-full border border-white/10 bg-[#202630]/92 px-3 py-1.5 font-semibold text-slate-200">
                {activeFiltersCount} active filters
              </span>
            ) : null}
            {(searchText || activeFiltersCount > 0) ? (
              <button
                type="button"
                onClick={clearFilters}
                className="font-bold text-[var(--brand-gold)] transition hover:text-white"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        {loading ? <p className="mt-6 text-slate-400">Loading tours...</p> : null}

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sortedTours.map((tour) => (
              (() => {
                const locationLabel = getTourLocationLabel(tour);
                const priceLabel = getTourPriceLabel(tour);
                const cardTag = getTourCardTag(tour);
                return (
              <article key={tour.id} className="group relative isolate min-h-[360px] overflow-hidden rounded-[28px] border border-white/10 bg-[#11161d] shadow-[0_24px_56px_rgba(0,0,0,0.28)]">
                <img
                  src={tour.images?.[0] || TOUR_PLACEHOLDER_IMAGE}
                  alt={tour.title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(109,188,228,0.18),transparent_28%),linear-gradient(180deg,rgba(7,10,15,0.14)_0%,rgba(7,10,15,0.3)_26%,rgba(7,10,15,0.72)_68%,rgba(7,10,15,0.92)_100%)]" />
                <div className="relative z-10 flex h-full flex-col p-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[rgba(28,91,56,0.92)] px-3 py-1 text-xs font-black text-white shadow-lg shadow-black/10">
                      {tour.category?.name ?? "Tour"}
                    </span>
                    <span className="rounded-full border border-white/12 bg-[rgba(37,44,57,0.82)] px-3 py-1 text-xs font-black text-white backdrop-blur-sm">
                      {cardTag}
                    </span>
                    {tour.featured ? (
                      <span className="rounded-full border border-[var(--brand-gold)]/40 bg-[rgba(250,178,79,0.16)] px-3 py-1 text-xs font-black text-[var(--brand-gold)] backdrop-blur-sm">
                        Featured
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto">
                    <h3 className="max-w-[20ch] text-[1.42rem] font-black leading-[1.12] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)] md:text-[1.56rem]">
                      {tour.title}
                    </h3>
                    {locationLabel ? <p className="mt-3 text-sm font-semibold text-slate-200">{locationLabel}</p> : null}

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <Link
                        href={`/tours/${encodeURIComponent(getTourRouteParam(tour))}`}
                        className="rounded-full bg-[var(--brand-gold)] px-4 py-2.5 text-sm font-extrabold text-[#11151c] transition hover:brightness-105"
                      >
                        View tour
                      </Link>
                      {priceLabel ? (
                        <span className="text-[1.7rem] font-black text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)] md:text-[1.9rem]">{priceLabel}</span>
                      ) : (
                        <span className="rounded-full border border-white/12 bg-[rgba(22,26,34,0.72)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-200 backdrop-blur-sm">
                          Info only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
                );
              })()
            ))}
        </div>

        {!loading && sortedTours.length === 0 && (
          <p className="mt-6 rounded-2xl border border-white/10 bg-[#202630]/92 p-4 text-slate-300 shadow">No tours match the selected filters.</p>
        )}
      </div>

      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Filters panel">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => setIsMobileFiltersOpen(false)}
            aria-label="Close filters panel"
          />

          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#202630] shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 md:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-gold)]">Filters</p>
                <h3 className="mt-1 text-xl font-extrabold text-white">Customize your search</h3>
              </div>
              <div className="flex items-center gap-4">
                <button type="button" onClick={clearFilters} className="text-sm font-bold text-[var(--brand-gold)] transition hover:text-white">
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-xl leading-none text-white"
                  aria-label="Close filters"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-5 md:px-6">{filtersControls}</div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 md:px-6">
              <label className="flex min-w-[220px] items-center gap-3 rounded-2xl border border-white/10 bg-[#171c24] px-4 py-3 text-sm font-bold text-slate-300">
                <span className="whitespace-nowrap text-slate-400">Sort by</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-[#1b2230] px-2 py-1 font-extrabold text-white focus:border-[var(--brand-gold)] focus:outline-none"
                >
                  <option value="featured" className="bg-[#1b2230] text-white">Featured</option>
                  <option value="price-asc" className="bg-[#1b2230] text-white">Price: low to high</option>
                  <option value="price-desc" className="bg-[#1b2230] text-white">Price: high to low</option>
                  <option value="name-asc" className="bg-[#1b2230] text-white">Name: A-Z</option>
                  <option value="name-desc" className="bg-[#1b2230] text-white">Name: Z-A</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="rounded-2xl bg-[var(--brand-gold)] px-5 py-3 text-sm font-extrabold text-[#11151c] transition hover:brightness-105"
              >
                View results
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
