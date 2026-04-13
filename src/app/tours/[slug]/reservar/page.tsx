"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { phoneCountryOptions } from "../../../../lib/phoneCountryOptions";

type OnvoPayConfig = {
  onError?: (data: unknown) => void;
  onSuccess?: (data: unknown) => void;
  publicKey: string;
  paymentIntentId: string;
  paymentType: "one_time";
  locale?: "es" | "en";
};

type OnvoInstance = {
  render: (selector: string) => void;
};

type OnvoClient = {
  pay: (config: OnvoPayConfig) => OnvoInstance;
};

declare global {
  interface Window {
    onvo?: OnvoClient;
  }
}

const ONVO_SDK_URL = "https://sdk.onvopay.com/sdk.js";
let onvoScriptPromise: Promise<void> | null = null;

function loadOnvoScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ONVO SDK solo esta disponible en el navegador."));
  if (window.onvo?.pay) return Promise.resolve();
  if (onvoScriptPromise) return onvoScriptPromise;

  onvoScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(`script[src=\"${ONVO_SDK_URL}\"]`) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.onvo?.pay) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("No se pudo cargar el SDK de ONVO.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = ONVO_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el SDK de ONVO."));
    document.head.appendChild(script);
  });

  return onvoScriptPromise;
}

interface Availability {
  id: number;
  date: string;
  maxPeople: number;
  timeSlots?: string[];
}

type AvailabilityMode = "SPECIFIC" | "OPEN";

interface OpenScheduleConfig {
  maxPeople: number;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  useCustomTimes: boolean;
  customTimesText: string;
}

interface AvailabilityConfig {
  mode: AvailabilityMode;
  openSchedule: OpenScheduleConfig;
  dateSchedules: Record<string, string[]>;
}

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

interface LocalTourAvailability {
  id: number;
  slug?: string;
  title?: string;
  images?: string[];
  price?: number;
  minPeople?: number;
  tourPackages?: TourPackage[];
  priceOptions?: TourPriceOption[];
  availability?: Availability[];
  availabilityConfig?: AvailabilityConfig;
}

const LOCAL_TOURS_KEY = "toursAdminLocalTours";
const TOUR_PLACEHOLDER_IMAGE = "/tour-placeholder.svg";

interface TourLite {
  id: number;
  title: string;
  image: string;
  price: number;
  minPeople: number;
  tourPackages: TourPackage[];
  availabilityConfig?: AvailabilityConfig;
}

const defaultOpenSchedule: OpenScheduleConfig = {
  maxPeople: 10,
  startTime: "08:00",
  endTime: "17:00",
  intervalMinutes: 30,
  useCustomTimes: false,
  customTimesText: "",
};

const defaultAvailabilityConfig: AvailabilityConfig = {
  mode: "SPECIFIC",
  openSchedule: defaultOpenSchedule,
  dateSchedules: {},
};

function normalizeTime24(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(time24: string): number {
  const [hours, minutes] = time24.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeTimeSlots(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items
        .map((item) => normalizeTime24(item))
        .filter((item): item is string => Boolean(item)),
    ),
  ).sort();
}

function formatTimeLabel(time24: string): string {
  const [hoursRaw, minutesRaw] = time24.split(":").map(Number);
  const suffix = hoursRaw >= 12 ? "PM" : "AM";
  const hours = hoursRaw % 12 || 12;
  return `${hours}:${String(minutesRaw).padStart(2, "0")} ${suffix}`;
}

function getCurrentTime24(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function buildIntervalTimeSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
  const start = normalizeTime24(startTime);
  const end = normalizeTime24(endTime);
  const safeInterval = Number.isFinite(intervalMinutes) ? Math.floor(intervalMinutes) : 0;
  if (!start || !end || safeInterval <= 0) return [];
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin > endMin) return [];

  const slots: string[] = [];
  for (let min = startMin; min <= endMin; min += safeInterval) {
    const hours = Math.floor(min / 60);
    const minutes = min % 60;
    slots.push(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
  }
  return slots;
}

function parseCustomTimeSlots(input: string): string[] {
  return Array.from(
    new Set(
      String(input || "")
        .split(/[\n,;]+/)
        .map((item) => normalizeTime24(item))
        .filter((item): item is string => Boolean(item)),
    ),
  ).sort();
}

function buildTimeSlotsFromSchedule(schedule: OpenScheduleConfig): string[] {
  return schedule.useCustomTimes
    ? parseCustomTimeSlots(schedule.customTimesText)
    : buildIntervalTimeSlots(schedule.startTime, schedule.endTime, schedule.intervalMinutes);
}

function normalizeAvailabilityConfig(input: unknown): AvailabilityConfig {
  // Handle JSON string from database
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return defaultAvailabilityConfig;
    }
  }

  if (!parsed || typeof parsed !== "object") return defaultAvailabilityConfig;
  const source = parsed as Partial<AvailabilityConfig> & { availabilityMode?: unknown };
  const openSource = source.openSchedule ?? defaultOpenSchedule;
  const dateSchedulesRaw = source.dateSchedules;
  const rawMode = String(source.mode ?? source.availabilityMode ?? "").trim().toUpperCase();
  const dateSchedules: Record<string, string[]> = {};

  if (dateSchedulesRaw && typeof dateSchedulesRaw === "object" && !Array.isArray(dateSchedulesRaw)) {
    Object.entries(dateSchedulesRaw).forEach(([key, value]) => {
      dateSchedules[key] = normalizeTimeSlots(value);
    });
  }

  return {
    mode: rawMode === "OPEN" ? "OPEN" : "SPECIFIC",
    openSchedule: {
      maxPeople: Number.isFinite(Number(openSource.maxPeople)) && Number(openSource.maxPeople) > 0 ? Math.floor(Number(openSource.maxPeople)) : 10,
      startTime: normalizeTime24(openSource.startTime) ?? "08:00",
      endTime: normalizeTime24(openSource.endTime) ?? "17:00",
      intervalMinutes: Number.isFinite(Number(openSource.intervalMinutes)) && Number(openSource.intervalMinutes) > 0 ? Math.floor(Number(openSource.intervalMinutes)) : 30,
      useCustomTimes: Boolean(openSource.useCustomTimes),
      customTimesText: String(openSource.customTimesText ?? ""),
    },
    dateSchedules,
  };
}

function sanitizeAvailabilityItems(items: unknown): Availability[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const source = item as { id?: unknown; date?: unknown; maxPeople?: unknown; timeSlots?: unknown };
      const id = Number(source?.id);
      const maxPeople = Number(source?.maxPeople);
      return {
        id: Number.isFinite(id) ? id : 0,
        date: String(source?.date ?? ""),
        maxPeople: Number.isFinite(maxPeople) ? maxPeople : 0,
        timeSlots: normalizeTimeSlots(source?.timeSlots),
      } satisfies Availability;
    })
    .filter((item) => item.date && item.maxPeople > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function applyDateSchedulesToAvailability(items: Availability[], dateSchedules: Record<string, string[]>): Availability[] {
  return items.map((item) => {
    const key = String(item.date).slice(0, 10);
    return {
      ...item,
      timeSlots: normalizeTimeSlots(key ? dateSchedules[key] ?? item.timeSlots : item.timeSlots),
    };
  });
}

function formatCurrencyUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKeyInput(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toMonthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fromMonthKey(monthKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
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

      return { id, name, price, isFree, isBase };
    })
    .filter((item) => item.id && item.name && (item.isFree || (Number.isFinite(item.price) && item.price > 0)));
}

function getVisiblePriceOptions(options: TourPriceOption[]): TourPriceOption[] {
  const visible = options.filter((item) => item.name.trim() && (item.isFree || Number.isFinite(item.price)));
  if (visible.length) return visible;
  return [];
}

function formatOptionPrice(option: TourPriceOption): string {
  if (option.isFree || option.price === 0) return "Gratis";
  return formatCurrencyUSD(option.price);
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

function buildNormalizedPackages(tour: { tourPackages?: unknown; priceOptions?: unknown; price?: number }): TourPackage[] {
  const normalizedPackages = normalizeTourPackages(tour.tourPackages);
  if (normalizedPackages.length > 0) return normalizedPackages;

  const legacyOptions = normalizePriceOptions(tour.priceOptions);
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

function slugifyTourValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getLocalReservationSeed(tourSlug: string): {
  tour: TourLite | null;
  availability: Availability[];
  availabilityConfig: AvailabilityConfig;
  visibleMonth: Date | null;
} {
  if (!tourSlug || typeof window === "undefined") {
    return { tour: null, availability: [], availabilityConfig: defaultAvailabilityConfig, visibleMonth: null };
  }

  const localTours = safeParse<LocalTourAvailability[]>(localStorage.getItem(LOCAL_TOURS_KEY), []);
  const localTour = localTours.find((item) => {
    const candidateSlug = typeof item.slug === "string" && item.slug.trim() ? item.slug : slugifyTourValue(String(item.title ?? ""));
    return candidateSlug === tourSlug;
  });
  const availabilityConfig = normalizeAvailabilityConfig(localTour?.availabilityConfig);
  const availability = applyDateSchedulesToAvailability(sanitizeAvailabilityItems(localTour?.availability), availabilityConfig.dateSchedules);

  const firstDate = availability[0] ? new Date(availability[0].date) : null;
  const fallbackMonth = availabilityConfig.mode === "OPEN" ? monthStart(new Date()) : null;

  return {
    tour: localTour
      ? {
          id: localTour.id,
          title: localTour.title || "Tour",
          image: Array.isArray(localTour.images) && localTour.images[0] ? localTour.images[0] : TOUR_PLACEHOLDER_IMAGE,
          price: typeof localTour.price === "number" ? localTour.price : 0,
          minPeople: Math.max(1, Number(localTour.minPeople) || 1),
          tourPackages: buildNormalizedPackages(localTour),
          availabilityConfig,
        }
      : null,
    availability,
    availabilityConfig,
    visibleMonth: firstDate ? new Date(firstDate.getFullYear(), firstDate.getMonth(), 1) : fallbackMonth,
  };
}

export default function ReservarPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tourSlug = typeof params?.slug === "string" ? params.slug : "";
  const packageFromQuery = searchParams?.get("package") ?? null;
  const dateFromQuery = searchParams?.get("date") ?? null;

  return (
    <ReservarPageContent
      key={`${tourSlug}:${packageFromQuery ?? "default"}:${dateFromQuery ?? "no-date"}`}
      tourSlug={tourSlug}
      packageFromQuery={packageFromQuery}
      dateFromQuery={dateFromQuery}
    />
  );
}

function ReservarPageContent({
  tourSlug,
  packageFromQuery,
  dateFromQuery,
}: {
  tourSlug: string;
  packageFromQuery: string | null;
  dateFromQuery: string | null;
}) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  const [tour, setTour] = useState<TourLite | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const [availability, setAvailability] = useState<Availability[]>([]);
  const [availabilityConfig, setAvailabilityConfig] = useState<AvailabilityConfig>(defaultAvailabilityConfig);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [priceQuantities, setPriceQuantities] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"seleccion" | "contacto" | "pago">("seleccion");

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryDialCode, setPhoneCountryDialCode] = useState("");
  const [phone, setPhone] = useState("");
  const [hotel, setHotel] = useState("");
  const [payMethod, setPayMethod] = useState("Tarjeta de Credito o Debito (ONVO)");
  const [sinpeReceiptFile, setSinpeReceiptFile] = useState<File | null>(null);
  const [sinpeReceiptUrl, setSinpeReceiptUrl] = useState("");
  const [isUploadingSinpeReceipt, setIsUploadingSinpeReceipt] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isConfirmingReservation, setIsConfirmingReservation] = useState(false);
  const [isRedirectingToConfirmation, setIsRedirectingToConfirmation] = useState(false);

  const [status, setStatus] = useState("");
  const [stepError, setStepError] = useState<{ step: "seleccion" | "contacto" | "pago"; message: string } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(15 * 60);
  const todayDateKey = toDateKey(new Date());
  const normalizedDateFromQuery = normalizeDateKeyInput(dateFromQuery);

  useEffect(() => {
    setHydrated(true);
    if (!tourSlug) return;

    // Pre-populate desde localStorage mientras carga el API
    const localData = getLocalReservationSeed(tourSlug);
    if (localData.tour) {
      const localAvailabilityFuture = localData.availability.filter((item) => String(item.date).slice(0, 10) >= todayDateKey);
      const firstFutureDateKey = localAvailabilityFuture[0] ? String(localAvailabilityFuture[0].date).slice(0, 10) : null;
      const queryDateIsFuture = Boolean(normalizedDateFromQuery && normalizedDateFromQuery >= todayDateKey);
      setTour(localData.tour);
      setAvailability(localAvailabilityFuture);
      setAvailabilityConfig(localData.availabilityConfig);
      setSelectedDateKey(queryDateIsFuture ? normalizedDateFromQuery : firstFutureDateKey ?? (localData.availabilityConfig.mode === "OPEN" ? todayDateKey : null));

      if (queryDateIsFuture) {
        const queryDate = new Date(`${normalizedDateFromQuery}T00:00:00`);
        setVisibleMonth(new Date(queryDate.getFullYear(), queryDate.getMonth(), 1));
      } else if (localAvailabilityFuture[0]) {
        const firstDate = new Date(localAvailabilityFuture[0].date);
        setVisibleMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
      } else {
        setVisibleMonth(localData.availabilityConfig.mode === "OPEN" ? monthStart(new Date()) : localData.visibleMonth);
      }
    }

    fetch(`/api/tour?slug=${encodeURIComponent(tourSlug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.id) {
          const nextConfig = normalizeAvailabilityConfig(data.availabilityConfig);
          const nextAvailabilityRaw = applyDateSchedulesToAvailability(sanitizeAvailabilityItems(data.availability), nextConfig.dateSchedules);
          const nextAvailability = nextAvailabilityRaw.filter((item) => String(item.date).slice(0, 10) >= todayDateKey);
          const queryDateIsFuture = Boolean(normalizedDateFromQuery && normalizedDateFromQuery >= todayDateKey);

          setTour({
            id: data.id,
            title: data.title,
            image: Array.isArray(data.images) && data.images[0] ? data.images[0] : TOUR_PLACEHOLDER_IMAGE,
            price: typeof data.price === "number" ? data.price : 0,
            minPeople: Math.max(1, Number(data.minPeople) || 1),
            tourPackages: buildNormalizedPackages(data),
            availabilityConfig: nextConfig,
          });
          setAvailabilityConfig(nextConfig);
          setAvailability(nextAvailability);
          setSelectedDateKey(queryDateIsFuture ? normalizedDateFromQuery : nextAvailability[0] ? String(nextAvailability[0].date).slice(0, 10) : nextConfig.mode === "OPEN" ? todayDateKey : null);
          if (queryDateIsFuture) {
            const queryDate = new Date(`${normalizedDateFromQuery}T00:00:00`);
            setVisibleMonth(new Date(queryDate.getFullYear(), queryDate.getMonth(), 1));
          } else if (nextAvailability[0]) {
            const first = new Date(nextAvailability[0].date);
            setVisibleMonth(new Date(first.getFullYear(), first.getMonth(), 1));
          } else if (nextConfig.mode === "OPEN") {
            setVisibleMonth(monthStart(new Date()));
          }
          setLoadError("");
          return;
        }
        setLoadError("No se encontro informacion del tour solicitado en el servidor.");
      })
      .catch(() => {
        setLoadError("No se pudo cargar la informacion del tour desde el servidor.");
      });
  }, [normalizedDateFromQuery, todayDateKey, tourSlug]);

  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [hydrated]);

  useEffect(() => {
    if (!tour?.tourPackages?.length) return;
    if (selectedPackageId) return;

    if (packageFromQuery) {
      const packageFromUrl = tour.tourPackages.find((pkg) => pkg.id === packageFromQuery);
      if (packageFromUrl) {
        setSelectedPackageId(packageFromUrl.id);
        return;
      }
    }

    setSelectedPackageId(tour.tourPackages[0].id);
  }, [packageFromQuery, selectedPackageId, tour]);

  const selectedPackage = useMemo(() => {
    if (!tour?.tourPackages?.length) return null;
    return tour.tourPackages.find((pkg) => pkg.id === selectedPackageId) || tour.tourPackages[0] || null;
  }, [selectedPackageId, tour]);

  const visiblePriceOptions = useMemo(() => {
    if (!tour) return [];
    const sourceOptions = selectedPackage?.priceOptions || [];
    return getVisiblePriceOptions(sourceOptions);
  }, [selectedPackage, tour]);

  const isInfoOnlyTour = useMemo(() => {
    if (!tour) return false;
    return !Array.isArray(tour.tourPackages) || !tour.tourPackages.some((pkg) => Array.isArray(pkg.priceOptions) && pkg.priceOptions.length > 0);
  }, [tour]);

  const normalizedPriceQuantities = useMemo(() => {
    if (!visiblePriceOptions.length) return {} as Record<string, number>;

    const next: Record<string, number> = {};
    visiblePriceOptions.forEach((option) => {
      next[option.id] = priceQuantities[option.id] ?? 0;
    });

    const totalSelected = Object.values(next).reduce((acc, value) => acc + value, 0);
    if (totalSelected === 0) {
      const baseOption = visiblePriceOptions.find((option) => option.isBase);
      next[(baseOption || visiblePriceOptions[0]).id] = 1;
    }

    return next;
  }, [priceQuantities, visiblePriceOptions]);

  const totalPeople = useMemo(
    () => visiblePriceOptions.reduce((acc, option) => acc + (normalizedPriceQuantities[option.id] ?? 0), 0),
    [normalizedPriceQuantities, visiblePriceOptions],
  );

  const subtotal = useMemo(
    () => visiblePriceOptions.reduce((acc, option) => acc + (normalizedPriceQuantities[option.id] ?? 0) * option.price, 0),
    [normalizedPriceQuantities, visiblePriceOptions],
  );
  const serviceFee = useMemo(() => subtotal * 0.06, [subtotal]);
  const total = useMemo(() => subtotal + serviceFee, [subtotal, serviceFee]);

  const activeSelectedDateKey =
    selectedDateKey ?? (availability[0] ? String(availability[0].date).slice(0, 10) : availabilityConfig.mode === "OPEN" ? toDateKey(new Date()) : null);

  const availabilityByDateKey = useMemo(() => {
    if (availabilityConfig.mode === "OPEN") return new Map<string, Availability>();
    const map = new Map<string, Availability>();
    availability.forEach((item) => {
      const key = String(item.date).slice(0, 10);
      if (!map.has(key)) map.set(key, item);
    });
    return map;
  }, [availability, availabilityConfig.mode]);

  const selectedDate = useMemo(() => {
    const key = activeSelectedDateKey;
    if (!key) return availability[0] ?? null;

    if (availabilityConfig.mode === "OPEN") {
      return {
        id: 0,
        date: `${key}T09:00:00.000Z`,
        maxPeople: availabilityConfig.openSchedule.maxPeople,
        timeSlots: buildTimeSlotsFromSchedule(availabilityConfig.openSchedule),
      } satisfies Availability;
    }

    const explicit = availabilityByDateKey.get(key);
    if (explicit) return explicit;

    return null;
  }, [activeSelectedDateKey, availability, availabilityByDateKey, availabilityConfig]);

  const openScheduleSlots = useMemo(
    () => buildTimeSlotsFromSchedule(availabilityConfig.openSchedule),
    [availabilityConfig.openSchedule],
  );

  const selectedDateTimeOptions = useMemo(() => {
    if (!selectedDate) return [] as string[];
    const fromDate = normalizeTimeSlots(selectedDate.timeSlots);
    const baseOptions = fromDate.length ? fromDate : availabilityConfig.mode === "OPEN" ? openScheduleSlots : [];
    const selectedKey = activeSelectedDateKey;
    if (!selectedKey || selectedKey !== todayDateKey) return baseOptions;

    const nowTime = getCurrentTime24();
    return baseOptions.filter((time24) => time24 >= nowTime);
  }, [activeSelectedDateKey, availabilityConfig.mode, openScheduleSlots, selectedDate, todayDateKey]);

  const hasConfiguredTimeSlots = useMemo(() => {
    if (!selectedDate) return false;
    const fromDate = normalizeTimeSlots(selectedDate.timeSlots);
    if (fromDate.length) return true;
    return availabilityConfig.mode === "OPEN" && openScheduleSlots.length > 0;
  }, [availabilityConfig.mode, openScheduleSlots, selectedDate]);

  const hasNoRemainingTimeToday =
    activeSelectedDateKey === todayDateKey && hasConfiguredTimeSlots && selectedDateTimeOptions.length === 0;

  const calendarHasOpenAvailability = availabilityConfig.mode === "OPEN";

  const effectiveSelectedTime =
    selectedDateTimeOptions.length === 0
      ? "Por coordinar"
      : selectedDateTimeOptions.includes(selectedTime)
        ? selectedTime
        : selectedDateTimeOptions[0];

  const calendarDays = useMemo(() => {
    if (!visibleMonth) return [] as Array<Date | null>;
    const start = monthStart(visibleMonth);
    const end = monthEnd(visibleMonth);
    const firstWeekday = (start.getDay() + 6) % 7;
    const dayCells: Array<Date | null> = [];

    for (let i = 0; i < firstWeekday; i += 1) dayCells.push(null);
    for (let d = 1; d <= end.getDate(); d += 1) {
      dayCells.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), d));
    }
    while (dayCells.length % 7 !== 0) dayCells.push(null);

    return dayCells;
  }, [visibleMonth]);

  const specificAvailableMonthKeys = useMemo(() => {
    if (availabilityConfig.mode === "OPEN") return [] as string[];
    const keys = Array.from(availabilityByDateKey.keys()).filter((key) => key >= todayDateKey);
    return Array.from(new Set(keys.map((key) => key.slice(0, 7)))).sort();
  }, [availabilityByDateKey, availabilityConfig.mode, todayDateKey]);

  const visibleMonthKey = useMemo(() => {
    if (!visibleMonth) return null;
    return toMonthKeyFromDate(visibleMonth);
  }, [visibleMonth]);

  const previousSpecificAvailableMonthKey = useMemo(() => {
    if (!visibleMonthKey) return null;
    const previous = specificAvailableMonthKeys.filter((key) => key < visibleMonthKey);
    return previous.length ? previous[previous.length - 1] : null;
  }, [specificAvailableMonthKeys, visibleMonthKey]);

  const nextSpecificAvailableMonthKey = useMemo(() => {
    if (!visibleMonthKey) return null;
    const next = specificAvailableMonthKeys.find((key) => key > visibleMonthKey);
    return next ?? null;
  }, [specificAvailableMonthKeys, visibleMonthKey]);

  useEffect(() => {
    if (availabilityConfig.mode === "OPEN") return;
    if (!specificAvailableMonthKeys.length || !visibleMonthKey) return;
    if (specificAvailableMonthKeys.includes(visibleMonthKey)) return;

    const firstMonth = fromMonthKey(specificAvailableMonthKeys[0]);
    if (firstMonth) setVisibleMonth(firstMonth);
  }, [availabilityConfig.mode, specificAvailableMonthKeys, visibleMonthKey]);

  useEffect(() => {
    if (!activeSelectedDateKey) return;
    if (activeSelectedDateKey >= todayDateKey) return;

    const futureDateKeys = Array.from(availabilityByDateKey.keys()).filter((key) => key >= todayDateKey).sort();
    if (futureDateKeys[0]) {
      setSelectedDateKey(futureDateKeys[0]);
      return;
    }

    if (availabilityConfig.mode === "OPEN") {
      setSelectedDateKey(todayDateKey);
      return;
    }

    setSelectedDateKey(null);
  }, [activeSelectedDateKey, availabilityByDateKey, availabilityConfig.mode, todayDateKey]);

  const countdownLabel = useMemo(() => {
    const min = Math.floor(remainingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = (remainingSeconds % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  }, [remainingSeconds]);

  const minimumPeople = Math.max(1, tour?.minPeople ?? 1);
  const meetsMinimumPeople = totalPeople >= minimumPeople;
  const hasSelectionStepCompleted =
    !isInfoOnlyTour &&
    Boolean(activeSelectedDateKey) &&
    totalPeople > 0 &&
    meetsMinimumPeople &&
    !hasNoRemainingTimeToday;
  const canContinueToPay =
    hasSelectionStepCompleted &&
    name.trim() &&
    lastName.trim() &&
    email.trim() &&
    phoneCountryDialCode.trim() &&
    phone.trim();
  const isSinpeMobileMethod = payMethod === "SINPE Movil";

  useEffect(() => {
    if (step === "pago" && !canContinueToPay) {
      setStep(hasSelectionStepCompleted ? "contacto" : "seleccion");
      return;
    }

    if (step === "contacto" && !hasSelectionStepCompleted) {
      setStep("seleccion");
    }
  }, [canContinueToPay, hasSelectionStepCompleted, step]);

  const openSelectionStep = () => {
    setStepError(null);
    setStep("seleccion");
  };
  const openContactStep = () => {
    if (isConfirmingReservation) return;
    if (!hasSelectionStepCompleted) {
      setStepError({
        step: "contacto",
        message:
        hasNoRemainingTimeToday
          ? "Ya no hay horarios disponibles para hoy. Elige otra fecha para continuar."
          : `Completa primero el paso 1 (fecha, horario y minimo ${minimumPeople} persona${minimumPeople === 1 ? "" : "s"}).`,
      });
      return;
    }
    setStepError(null);
    setStep("contacto");
  };
  const openPaymentStep = () => {
    if (isConfirmingReservation) return;
    if (!hasSelectionStepCompleted) {
      setStepError({
        step: "pago",
        message:
        hasNoRemainingTimeToday
          ? "Ya no hay horarios disponibles para hoy. Elige otra fecha para continuar."
          : `Completa primero el paso 1 (fecha, horario y minimo ${minimumPeople} persona${minimumPeople === 1 ? "" : "s"}).`,
      });
      return;
    }
    if (!canContinueToPay) {
      setStepError({ step: "pago", message: "Completa tus datos de contacto para poder abrir el paso de pago." });
      return;
    }
    setStepError(null);
    setStep("pago");
  };

  const navigateToConfirmation = (input: {
    reservationId: number;
    status: "confirmed" | "pending_validation";
    paymentMethod: string;
    message: string;
  }) => {
    setIsRedirectingToConfirmation(true);
    const query = new URLSearchParams({
      reserva: String(input.reservationId),
      estado: input.status,
      metodo: input.paymentMethod,
      mensaje: input.message,
    });
    router.push(`/reserva-confirmada?${query.toString()}`);
  };

  const confirmPaymentWithRetry = async (reservationId: number, paymentIntentId: string): Promise<{ ok: boolean; message: string }> => {
    const maxAttempts = 8;
    const delayMs = 2500;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const confirmRes = await fetch("/api/reservar-confirmar-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          paymentIntentId,
        }),
      });

      const confirmPayload = await confirmRes.json().catch(() => null);

      if (confirmRes.ok) {
        return {
          ok: true,
          message: String(confirmPayload?.message || "Pago aprobado y reserva confirmada."),
        };
      }

      if (confirmRes.status === 202) {
        setStatus("Pago recibido. Esperando confirmacion final...");
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      return {
        ok: false,
        message: confirmPayload?.error
          ? `Pago recibido, pero no se pudo confirmar la reserva: ${confirmPayload.error}`
          : "Pago recibido, pero no se pudo confirmar la reserva.",
      };
    }

    return {
      ok: false,
      message: "Pago recibido, pero la confirmacion esta tardando mas de lo esperado. Te avisaremos por correo al confirmarse.",
    };
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isInfoOnlyTour) {
      setStatus("Este tour es solo informativo y no permite reservas en linea.");
      return;
    }

    if (hasNoRemainingTimeToday) {
      setStatus("Ya no hay horarios disponibles para hoy. Elige otra fecha.");
      return;
    }

    const people = totalPeople;
    if (people <= 0) {
      setStatus("Selecciona al menos una persona para continuar.");
      return;
    }

    if (people < minimumPeople) {
      setStatus(`Este tour requiere minimo ${minimumPeople} persona${minimumPeople === 1 ? "" : "s"}.`);
      return;
    }

    const selectedPrices = visiblePriceOptions
      .map((option) => ({
        id: option.id,
        quantity: normalizedPriceQuantities[option.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);

    let uploadedSinpeReceiptUrl = sinpeReceiptUrl;

    if (isSinpeMobileMethod) {
      if (!sinpeReceiptFile && !uploadedSinpeReceiptUrl) {
        setStatus("Para SINPE Movil debes subir el comprobante antes de completar la reserva.");
        return;
      }

      if (!uploadedSinpeReceiptUrl && sinpeReceiptFile) {
        try {
          setIsUploadingSinpeReceipt(true);
          setStatus("Subiendo comprobante SINPE...");

          const formData = new FormData();
          formData.append("receipt", sinpeReceiptFile);
          const uploadRes = await fetch("/api/upload-receipt", {
            method: "POST",
            body: formData,
          });
          const uploadPayload = await uploadRes.json().catch(() => null);

          if (!uploadRes.ok) {
            setStatus(uploadPayload?.error ? `No se pudo subir el comprobante: ${uploadPayload.error}` : "No se pudo subir el comprobante SINPE.");
            return;
          }

          uploadedSinpeReceiptUrl = String(uploadPayload?.url ?? "").trim();
          if (!uploadedSinpeReceiptUrl) {
            setStatus("No se recibio URL valida del comprobante SINPE.");
            return;
          }

          setSinpeReceiptUrl(uploadedSinpeReceiptUrl);
        } finally {
          setIsUploadingSinpeReceipt(false);
        }
      }
    }

    try {
      setIsCreatingPayment(true);
      setIsConfirmingReservation(false);
      setStatus(isSinpeMobileMethod ? "Validando reserva SINPE..." : "Preparando tu reserva y creando la sesion de pago...");

      if (!tour) {
        setStatus("No se encontro la informacion del tour. Recarga la pagina e intenta nuevamente.");
        return;
      }

      const fullPhone = `${phoneCountryDialCode} ${phone}`.trim();

      const res = await fetch("/api/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourId: tour.id,
          availabilityId: selectedDate && selectedDate.id > 0 ? selectedDate.id : null,
          selectedDate: activeSelectedDateKey,
          people,
          selectedPrices,
          name,
          lastName,
          email,
          phone: fullPhone,
          hotel,
          paymentMethod: payMethod,
          sinpeReceiptUrl: uploadedSinpeReceiptUrl,
          scheduleTime: effectiveSelectedTime,
          packageId: selectedPackage?.id,
          packageTitle: selectedPackage?.title,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(payload?.error ? `No se pudo confirmar la reserva: ${payload.error}` : "No se pudo confirmar la reserva.");
        return;
      }

      if (!payload?.requiresPayment) {
        const reservationId = Number(payload?.reservationId);
        if (!Number.isFinite(reservationId) || reservationId <= 0) {
          setStatus("La reserva se creo, pero no se recibio un numero de reserva valido.");
          return;
        }
        const nextMessage =
          String(payload?.message || "").trim() ||
          (isSinpeMobileMethod
            ? "Recibimos tu comprobante. Te contactaremos cuando el pago sea validado."
            : "Reserva confirmada. Te enviamos el detalle por correo.");

        if (isSinpeMobileMethod) {
          navigateToConfirmation({
            reservationId,
            status: "pending_validation",
            paymentMethod: payMethod,
            message: nextMessage,
          });
          return;
        }

        navigateToConfirmation({
          reservationId,
          status: "confirmed",
          paymentMethod: payMethod,
          message: nextMessage,
        });
        return;
      }

      const paymentIntentId = String(payload?.paymentIntentId ?? "").trim();
      const publicKey = String(payload?.publicKey ?? "").trim();
      const reservationId = Number(payload?.reservationId);

      if (!paymentIntentId || !publicKey || !Number.isFinite(reservationId) || reservationId <= 0) {
        setStatus("No se pudo iniciar el checkout. Intenta nuevamente.");
        return;
      }

      await loadOnvoScript();
      if (!window.onvo?.pay) {
        setStatus("No se pudo inicializar ONVO. Recarga la pagina e intenta nuevamente.");
        return;
      }

      const mountNode = document.getElementById("onvo-checkout-container");
      if (!mountNode) {
        setStatus("No se encontro el contenedor de pago. Intenta nuevamente.");
        return;
      }
      mountNode.innerHTML = "";

      const onvoCheckout = window.onvo.pay({
        publicKey,
        paymentIntentId,
        paymentType: "one_time",
        locale: "es",
        onError: (onvoError) => {
          const errorMessage =
            typeof onvoError === "object" && onvoError && "message" in onvoError
              ? String((onvoError as { message?: string }).message || "")
              : "";
          setStatus(errorMessage ? `Error en el pago: ${errorMessage}` : "El pago no pudo procesarse. Revisa los datos e intenta nuevamente.");
        },
        onSuccess: async () => {
          try {
            setStatus("Pago recibido. Confirmando reserva...");
            setIsConfirmingReservation(true);
            const confirmation = await confirmPaymentWithRetry(reservationId, paymentIntentId);
            if (!confirmation.ok) {
              setStatus(confirmation.message);
              setIsConfirmingReservation(false);
              return;
            }

            navigateToConfirmation({
              reservationId,
              status: "confirmed",
              paymentMethod: "Tarjeta de Credito o Debito (ONVO)",
              message: confirmation.message,
            });
          } catch {
            setStatus("Pago recibido, pero no se pudo validar la reserva por un error de conexion.");
            setIsConfirmingReservation(false);
          }
        },
      });

      onvoCheckout.render("#onvo-checkout-container");
      setStatus("Completa tu pago en el formulario seguro de ONVO para finalizar la reserva.");
    } catch {
      setStatus("No se pudo confirmar la reserva por un error de conexion.");
    } finally {
      setIsCreatingPayment(false);
    }
  };

  if (!hydrated) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-3 h-7 w-64 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-6">
            <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200 lg:sticky lg:top-6" />
        </div>
      </section>
    );
  }

  if (!tour) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Reserva tu tour</h1>
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {loadError || "No se pudo cargar la reserva porque el tour no esta disponible."}
        </p>
      </section>
    );
  }

  if (isInfoOnlyTour) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Reserva tu tour</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Este tour no tiene precios configurados y no permite reservas en linea.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Reserva tu tour</h1>

      <div className="mt-3 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
        Tiempo restante de carrito: {countdownLabel}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          {loadError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{loadError}</p>
          )}

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Paso 1: Paquete, fecha, horario y personas</h2>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-bold ${step === "seleccion" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={openSelectionStep}
              >
                Seleccion
              </button>
            </div>

            {step === "seleccion" && (
              <>

            {Boolean(tour.tourPackages.length) && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Paquete seleccionado</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {tour.tourPackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${selectedPackage?.id === pkg.id ? "border-emerald-500 bg-white text-emerald-900" : "border-emerald-200 bg-white text-slate-700 hover:border-emerald-300"}`}
                    >
                      {pkg.title}
                    </button>
                  ))}
                </div>
                {selectedPackage?.description && <p className="mt-2 text-xs text-slate-600">{selectedPackage.description}</p>}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (availabilityConfig.mode === "OPEN") {
                      setVisibleMonth((prev) => (prev ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1) : prev));
                      return;
                    }

                    if (!previousSpecificAvailableMonthKey) return;
                    const month = fromMonthKey(previousSpecificAvailableMonthKey);
                    if (month) setVisibleMonth(month);
                  }}
                  disabled={availabilityConfig.mode !== "OPEN" && !previousSpecificAvailableMonthKey}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <p className="text-center text-lg font-extrabold text-slate-800">
                  {visibleMonth
                    ? visibleMonth.toLocaleString("es-ES", { month: "long", year: "numeric" }).toUpperCase()
                    : "FECHAS DISPONIBLES"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (availabilityConfig.mode === "OPEN") {
                      setVisibleMonth((prev) => (prev ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1) : prev));
                      return;
                    }

                    if (!nextSpecificAvailableMonthKey) return;
                    const month = fromMonthKey(nextSpecificAvailableMonthKey);
                    if (month) setVisibleMonth(month);
                  }}
                  disabled={availabilityConfig.mode !== "OPEN" && !nextSpecificAvailableMonthKey}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => (
                  <span key={day} className="py-1">{day}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <span key={`empty-${index}`} className="h-10 rounded-md bg-transparent" />;
                  }

                  const key = toDateKey(day);
                  const isPastDay = key < todayDateKey;
                  const available = availabilityByDateKey.get(key);
                  const canSelect = (Boolean(available) || calendarHasOpenAvailability) && !isPastDay;
                  const isActive = activeSelectedDateKey === key;

                  const openMaxLabel = availabilityConfig.openSchedule.maxPeople;
                  const tooltip = isPastDay
                    ? "No disponible. Solo se permiten fechas desde hoy."
                    : available
                    ? `${available.maxPeople} lugares max.`
                    : calendarHasOpenAvailability
                      ? `Modo abierto: ${openMaxLabel} lugares max.`
                      : "No disponible";

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => setSelectedDateKey(key)}
                      className={`h-10 rounded-md border text-sm font-bold transition ${
                        isActive
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : canSelect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400"
                            : "cursor-not-allowed border-slate-200 bg-white text-slate-300"
                      }`}
                      title={tooltip}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                <span className="font-bold text-emerald-700">Fechas en color:</span> disponibles para reservar.
              </p>
            </div>

            <div className="mt-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Elige el horario</label>
                <select
                  value={effectiveSelectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800"
                >
                  {(selectedDateTimeOptions.length ? selectedDateTimeOptions : ["Por coordinar"]).map((option) => (
                    <option key={option} value={option}>
                      {option === "Por coordinar" ? option : formatTimeLabel(option)}
                    </option>
                  ))}
                </select>
                {hasNoRemainingTimeToday ? (
                  <p className="mt-2 text-xs font-bold text-rose-700">Ya no quedan horarios para hoy. Selecciona otra fecha.</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-lg font-extrabold text-slate-900">Precios</p>
              <p className="mt-1 text-xs text-slate-600">Puedes ajustar paquete y cantidades directamente en checkout.</p>
              {!meetsMinimumPeople && (
                <p className="mt-2 text-xs font-bold text-rose-700">
                  Debes seleccionar minimo {minimumPeople} persona{minimumPeople === 1 ? "" : "s"} en precios.
                </p>
              )}
              <div className="mt-3 space-y-3">
                {visiblePriceOptions.map((option) => {
                  const quantity = normalizedPriceQuantities[option.id] ?? 0;
                  const isSelected = quantity > 0;

                  return (
                  <div
                    key={option.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 transition ${
                      isSelected
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{option.name}</p>
                      <p className={`text-sm ${option.isFree || option.price === 0 ? "font-bold text-emerald-700" : "font-semibold text-amber-700"}`}>
                        {formatOptionPrice(option)} por pers.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-1 font-bold text-slate-700 hover:border-emerald-300"
                        onClick={() =>
                          setPriceQuantities((prev) => ({
                            ...prev,
                            [option.id]: Math.max(0, (normalizedPriceQuantities[option.id] ?? 0) - 1),
                          }))
                        }
                      >
                        -
                      </button>
                      <span className={`w-8 text-center font-extrabold ${isSelected ? "text-emerald-800" : "text-slate-700"}`}>{quantity}</span>
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-1 font-bold text-slate-700 hover:border-emerald-300"
                        onClick={() =>
                          setPriceQuantities((prev) => ({
                            ...prev,
                            [option.id]: (normalizedPriceQuantities[option.id] ?? 0) + 1,
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                );})}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-600">Total:</p>
              <p className="text-3xl font-black text-emerald-800">{formatCurrencyUSD(total)}</p>
            </div>

            <button
              type="button"
              onClick={openContactStep}
              disabled={!hasSelectionStepCompleted || isRedirectingToConfirmation}
              className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-3 font-extrabold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Ir a informacion de contacto
            </button>

            {stepError?.step === "seleccion" ? (
              <p className="mt-4 whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{stepError.message}</p>
            ) : null}
            </>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Paso 2: Datos de contacto</h2>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-bold ${step === "contacto" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={openContactStep}
              >
                Contacto
              </button>
            </div>

            {step === "contacto" && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Nombre</label>
                  <input
                    className="h-12 w-full rounded-lg border border-slate-300 px-3"
                    placeholder="Nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!meetsMinimumPeople || isRedirectingToConfirmation}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Apellido</label>
                  <input
                    className="h-12 w-full rounded-lg border border-slate-300 px-3"
                    placeholder="Apellido"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={!meetsMinimumPeople || isRedirectingToConfirmation}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Correo electronico</label>
                  <input
                    type="email"
                    className="h-12 w-full rounded-lg border border-slate-300 px-3"
                    placeholder="Correo electronico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!meetsMinimumPeople || isRedirectingToConfirmation}
                  />
                </div>
                <div className="md:col-span-2 grid gap-2 sm:grid-cols-[1.2fr_1.8fr]">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Codigo de pais</label>
                    <select
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3"
                      value={phoneCountryDialCode}
                      onChange={(e) => setPhoneCountryDialCode(e.target.value)}
                      disabled={!meetsMinimumPeople || isRedirectingToConfirmation}
                    >
                      <option value="">Selecciona un pais</option>
                      {phoneCountryOptions.map((option) => (
                        <option key={`${option.code}-${option.dialCode}`} value={option.dialCode}>
                          {option.name} ({option.dialCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Telefono</label>
                    <input
                      className="h-12 w-full rounded-lg border border-slate-300 px-3"
                      placeholder="Telefono"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={!meetsMinimumPeople || isRedirectingToConfirmation}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Hotel o lugar de hospedaje</label>
                  <input
                    className="h-12 w-full rounded-lg border border-slate-300 px-3"
                    placeholder="Hotel o lugar de hospedaje"
                    value={hotel}
                    onChange={(e) => setHotel(e.target.value)}
                    disabled={!meetsMinimumPeople || isRedirectingToConfirmation}
                  />
                </div>

                <button
                  type="button"
                  onClick={openPaymentStep}
                  disabled={!canContinueToPay}
                  className="md:col-span-2 mt-2 rounded-lg bg-emerald-700 px-4 py-3 font-extrabold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Continuar a pago
                </button>
              </div>
            )}

            {stepError?.step === "contacto" ? (
              <p className="mt-4 whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{stepError.message}</p>
            ) : null}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Paso 3: Metodo de pago</h2>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-bold ${step === "pago" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={openPaymentStep}
                disabled={isConfirmingReservation}
              >
                Pago
              </button>
            </div>

            {step === "pago" && !isConfirmingReservation && (
              <form onSubmit={handleReserve} className="mt-4 space-y-3">
                {["Tarjeta de Credito o Debito (ONVO)", "SINPE Movil"].map((method) => (
                  <button
                    type="button"
                    key={method}
                    onClick={() => setPayMethod(method)}
                    disabled={isRedirectingToConfirmation || isConfirmingReservation}
                    className={`w-full rounded-lg border px-4 py-3 text-left font-semibold transition ${
                      payMethod === method
                        ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                        : "border-slate-300 bg-white text-slate-700 hover:border-emerald-300"
                    }`}
                  >
                    {method}
                  </button>
                ))}

                {isSinpeMobileMethod ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-extrabold text-amber-900">Pago por SINPE Movil</p>
                    <p className="mt-1 text-sm text-amber-900">
                      Envia el total de la orden a <span className="font-extrabold">8888-9999</span> y sube el comprobante para completar la reserva.
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      Total a transferir: <span className="font-extrabold text-emerald-800">{formatCurrencyUSD(total)}</span>
                    </p>
                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Subir comprobante</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const nextFile = e.target.files?.[0] ?? null;
                          setSinpeReceiptFile(nextFile);
                          setSinpeReceiptUrl("");
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        required
                      />
                      {sinpeReceiptFile ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">Comprobante listo: {sinpeReceiptFile.name}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    !canContinueToPay ||
                    totalPeople <= 0 ||
                    !meetsMinimumPeople ||
                    hasNoRemainingTimeToday ||
                    isCreatingPayment ||
                    isConfirmingReservation ||
                    isUploadingSinpeReceipt ||
                    isRedirectingToConfirmation ||
                    (isSinpeMobileMethod && !sinpeReceiptFile && !sinpeReceiptUrl)
                  }
                  className="mt-3 w-full rounded-lg bg-amber-400 px-4 py-3 text-base font-extrabold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isRedirectingToConfirmation
                    ? "Redirigiendo..."
                    : isUploadingSinpeReceipt
                      ? "Subiendo comprobante..."
                      : isCreatingPayment
                        ? "Preparando pago..."
                        : isSinpeMobileMethod
                          ? "Enviar reserva con comprobante SINPE"
                          : "Confirmar reserva y pagar"}
                </button>

                {!isSinpeMobileMethod ? (
                  <div id="onvo-checkout-container" className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3" />
                ) : null}
              </form>
            )}

            {step === "pago" && isConfirmingReservation ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">Pago recibido. Confirmando reserva...</p>
              </div>
            ) : null}

            {stepError?.step === "pago" ? (
              <p className="mt-4 whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{stepError.message}</p>
            ) : null}

            {status && !isConfirmingReservation && (
              <p className="mt-4 whitespace-pre-line rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{status}</p>
            )}
          </article>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Resumen de compra</p>

          <div className="mt-4 flex gap-3 rounded-xl border border-slate-200 p-3">
            <img src={tour.image} alt={tour.title} className="h-16 w-20 rounded object-cover" />
            <div>
              <p className="text-sm font-extrabold text-slate-900">{tour.title}</p>
              {selectedPackage && <p className="text-xs font-semibold text-emerald-700">Paquete: {selectedPackage.title}</p>}
              <p className="text-xs text-slate-600">{selectedDate ? new Date(selectedDate.date).toLocaleDateString("es-ES") : "Fecha por confirmar"}</p>
              <p className="text-xs text-slate-600">{normalizeTime24(effectiveSelectedTime) ? formatTimeLabel(effectiveSelectedTime) : effectiveSelectedTime} | {totalPeople} pers.</p>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-xs text-slate-600">
            {visiblePriceOptions
              .filter((option) => (normalizedPriceQuantities[option.id] ?? 0) > 0)
              .map((option) => (
                <p key={`summary-${option.id}`}>
                  {option.name}: {normalizedPriceQuantities[option.id] ?? 0} x {formatOptionPrice(option)}
                </p>
              ))}
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">{formatCurrencyUSD(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tarifa de servicio (6%)</span>
              <span className="font-semibold">{formatCurrencyUSD(serviceFee)}</span>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-2xl font-black text-emerald-800">{formatCurrencyUSD(total)}</span>
            </div>
          </div>

        </aside>
      </div>
    </section>
  );
}
