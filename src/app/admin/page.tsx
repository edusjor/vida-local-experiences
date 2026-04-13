"use client";

import React, { Suspense, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TourStatus = "ACTIVO" | "NO_ACTIVO" | "BORRADOR";
type TourTab = "ACTIVOS" | "BORRADOR" | "DESACTIVADOS" | "PAPELERA";
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

interface TourEditorState {
  editingTourId: number | null;
  title: string;
  slug: string;
  description: string;
  minPeople: number;
  imageList: string[];
  categoryId: number | null;
  country: string;
  zone: string;
  departurePoint: string;
  durationDays: number | "";
  activityType: string;
  difficulty: string;
  guideType: string;
  transport: string;
  groups: string;
  storyText: string;
  tourPackages: TourPackageEditor[];
  includedText: string;
  recommendationsText: string;
  faqsList: FaqItem[];
  availabilityList: AvailabilityItem[];
  availabilityConfig: AvailabilityConfig;
  status: TourStatus;
  featured: boolean;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface AvailabilityItem {
  id: number;
  date: string;
  maxPeople: number;
  timeSlots?: string[];
}

interface PriceOptionEditor {
  id: string;
  name: string;
  price: number | string | "";
  isFree: boolean;
  isBase: boolean;
}

interface TourPackageEditor {
  id: string;
  title: string;
  description: string;
  priceOptions: PriceOptionEditor[];
}

interface Category {
  id: number;
  name: string;
  description?: string;
}

interface CategoryInput {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  category?: {
    id?: unknown;
    name?: unknown;
    description?: unknown;
  };
}

interface TourAdminView {
  id: number;
  title: string;
  slug?: string;
  createdAt?: string | null;
  description: string;
  price: number;
  minPeople?: number;
  images: string[];
  category: { id: number; name: string };
  status?: TourStatus;
  isDeleted?: boolean;
  deletedAt?: string | null;
  country?: string;
  zone?: string;
  departurePoint?: string;
  durationDays?: number;
  activityType?: string;
  difficulty?: string;
  guideType?: string;
  transport?: string;
  groups?: string;
  story?: string[];
  priceOptions?: PriceOptionEditor[];
  tourPackages?: TourPackageEditor[];
  includedItems?: string[];
  recommendations?: string[];
  faqs?: FaqItem[];
  availability?: AvailabilityItem[];
  availabilityConfig?: AvailabilityConfig;
  featured?: boolean;
}

interface AdminMediaItem {
  id: string;
  status: "active" | "trash";
  name: string;
  url: string;
  isImage: boolean;
}

interface AdminMediaApiResponse {
  items?: AdminMediaItem[];
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
const LOCAL_CATEGORIES_KEY = "toursAdminLocalCategories";
const FILTER_CONFIG_KEY = "toursFilterConfig";

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

const filterConfigLabels: Record<keyof FilterConfig, string> = {
  country: "Pais",
  zone: "Zona",
  price: "Precio",
  durationDays: "Duracion (dias)",
  activityType: "Tipo de actividad",
  category: "Categoria",
  difficulty: "Dificultad",
  featured: "Destacado",
};

const fallbackCategories: Category[] = [
  { id: 1, name: "Playa", description: "Experiencias de playa y mar" },
  { id: 2, name: "Aventura", description: "Tours con adrenalina y deporte" },
  { id: 3, name: "Naturaleza", description: "Bosques, cascadas y vida silvestre" },
  { id: 4, name: "Ciudad", description: "Recorridos culturales y urbanos" },
];

const defaultPriceOptionNames = [
  "Nacionales",
  "Extranjeros",
  "Estudiantes nacionales",
  "Estudiantes Extranjeros",
  "Niños nacionales",
  "Niños extranjeros",
];

const intervalMinuteOptions = [15, 30, 45, 60, 120, 180, 240];

function formatIntervalOptionLabel(value: number): string {
  if (value < 60) return `${value} min`;
  return `${Math.round(value / 60)}h`;
}

function getTourCreatedAtMs(tour: Pick<TourAdminView, "id" | "createdAt">): number {
  const raw = typeof tour.createdAt === "string" ? tour.createdAt.trim() : "";
  if (raw) {
    const parsed = new Date(raw).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const idAsTime = Number(tour.id);
  return Number.isFinite(idAsTime) ? idAsTime : 0;
}

function sortToursByRecent(items: TourAdminView[]): TourAdminView[] {
  return [...items].sort((a, b) => getTourCreatedAtMs(b) - getTourCreatedAtMs(a));
}

function formatCreatedAtLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-CR");
}

const hourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minuteOptions = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

function normalizeTime24(value: string): string | null {
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

function formatTimeLabel(time24: string): string {
  const [hoursRaw, minutesRaw] = time24.split(":").map(Number);
  const suffix = hoursRaw >= 12 ? "PM" : "AM";
  const hours = hoursRaw % 12 || 12;
  return `${hours}:${String(minutesRaw).padStart(2, "0")} ${suffix}`;
}

function normalizeTimeSlots(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items
        .map((item) => normalizeTime24(String(item)))
        .filter((item): item is string => Boolean(item)),
    ),
  ).sort();
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

const defaultOpenSchedule: OpenScheduleConfig = {
  maxPeople: 8,
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

function buildTimeSlotsFromSchedule(config: OpenScheduleConfig): string[] {
  return config.useCustomTimes
    ? parseCustomTimeSlots(config.customTimesText)
    : buildIntervalTimeSlots(config.startTime, config.endTime, config.intervalMinutes);
}

function normalizeOpenScheduleConfig(input: unknown): OpenScheduleConfig {
  if (!input || typeof input !== "object") return defaultOpenSchedule;
  const source = input as Partial<OpenScheduleConfig>;
  const parsedMaxPeople = Number(source.maxPeople);
  const parsedInterval = Number(source.intervalMinutes);

  return {
    maxPeople: Number.isFinite(parsedMaxPeople) && parsedMaxPeople > 0 ? Math.floor(parsedMaxPeople) : defaultOpenSchedule.maxPeople,
    startTime: normalizeTime24(String(source.startTime ?? defaultOpenSchedule.startTime)) ?? defaultOpenSchedule.startTime,
    endTime: normalizeTime24(String(source.endTime ?? defaultOpenSchedule.endTime)) ?? defaultOpenSchedule.endTime,
    intervalMinutes: Number.isFinite(parsedInterval) && parsedInterval > 0 ? Math.floor(parsedInterval) : defaultOpenSchedule.intervalMinutes,
    useCustomTimes: Boolean(source.useCustomTimes),
    customTimesText: String(source.customTimesText ?? ""),
  };
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
  const source = parsed as Partial<AvailabilityConfig>;
  const dateSchedulesRaw = source.dateSchedules;
  const dateSchedules: Record<string, string[]> = {};

  if (dateSchedulesRaw && typeof dateSchedulesRaw === "object" && !Array.isArray(dateSchedulesRaw)) {
    Object.entries(dateSchedulesRaw).forEach(([dateKey, slots]) => {
      dateSchedules[dateKey] = normalizeTimeSlots(slots);
    });
  }

  return {
    mode: source.mode === "OPEN" ? "OPEN" : "SPECIFIC",
    openSchedule: normalizeOpenScheduleConfig(source.openSchedule),
    dateSchedules,
  };
}

function buildDateSchedulesFromAvailability(items: AvailabilityItem[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  items.forEach((item) => {
    const dateKey = String(item.date || "").slice(0, 10);
    if (!dateKey) return;
    result[dateKey] = normalizeTimeSlots(item.timeSlots);
  });
  return result;
}

function applyDateSchedulesToAvailability(items: AvailabilityItem[], dateSchedules: Record<string, string[]>): AvailabilityItem[] {
  return items.map((item) => {
    const dateKey = String(item.date || "").slice(0, 10);
    return {
      ...item,
      timeSlots: dateKey ? normalizeTimeSlots(dateSchedules[dateKey] ?? item.timeSlots) : normalizeTimeSlots(item.timeSlots),
    };
  });
}

function slugifyPriceLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function slugifyTourValue(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return normalized;
}

function createDefaultPriceOptions(): PriceOptionEditor[] {
  return defaultPriceOptionNames.map((name) => ({
    id: `default-${slugifyPriceLabel(name)}`,
    name,
    price: "",
    isFree: false,
    isBase: false,
  }));
}

function sanitizePriceOptions(items: unknown): PriceOptionEditor[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const source = item as { id?: unknown; name?: unknown; price?: unknown; isFree?: unknown; isBase?: unknown };
      const name = String(source?.name ?? "").trim();
      const idRaw = String(source?.id ?? "").trim();
      const id = idRaw || `custom-${index}-${Date.now()}`;
      const isFree = Boolean(source?.isFree);
      const isBase = Boolean(source?.isBase);
      const parsedPrice = parseLooseDecimal(source?.price);
      const normalizedPrice: number | "" = isFree ? 0 : parsedPrice === null ? "" : roundPriceToTwo(parsedPrice);

      return {
        id,
        name,
        isFree,
        isBase,
        price: normalizedPrice,
      } satisfies PriceOptionEditor;
    })
    .filter((item) => item.name.length > 0);
}

function parseLooseDecimal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Accept both decimal separators: comma and dot.
  const normalized = raw.replace(/\s+/g, "").replace(/,/g, ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundPriceToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseEditorPriceInput(value: string): string {
  // Keep the raw input while typing so "80," or "80." is not cleared.
  return value.replace(/\s+/g, "");
}

function normalizeUnfreePrice(value: number | string | ""): number | string | "" {
  return value === 0 ? "" : value;
}

function buildEditorPriceOptions(items: unknown): PriceOptionEditor[] {
  const defaults = createDefaultPriceOptions();
  const saved = sanitizePriceOptions(items);

  const mergedDefaults = defaults.map((defaultItem) => {
    const match = saved.find((item) => item.id === defaultItem.id || item.name.toLowerCase() === defaultItem.name.toLowerCase());
    return match ? { ...defaultItem, ...match } : defaultItem;
  });

  const customItems = saved.filter(
    (item) => !mergedDefaults.some((defaultItem) => defaultItem.id === item.id || defaultItem.name.toLowerCase() === item.name.toLowerCase()),
  );

  const result = [...mergedDefaults, ...customItems];
  const firstBaseIndex = result.findIndex((item) => item.isBase);
  if (firstBaseIndex === -1) return result;

  return result.map((item, index) => ({ ...item, isBase: index === firstBaseIndex }));
}

function createEmptyTourPackage(defaultTitle = ""): TourPackageEditor {
  return {
    id: `pkg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: defaultTitle,
    description: "",
    priceOptions: createDefaultPriceOptions(),
  };
}

function ensureSingleBaseAcrossEditorPackages(items: TourPackageEditor[]): TourPackageEditor[] {
  if (!items.length) return items;

  let basePackageIndex = -1;
  let baseOptionIndex = -1;

  for (let pkgIndex = 0; pkgIndex < items.length; pkgIndex += 1) {
    const optionIndex = items[pkgIndex].priceOptions.findIndex((option) => option.isBase);
    if (optionIndex !== -1) {
      basePackageIndex = pkgIndex;
      baseOptionIndex = optionIndex;
      break;
    }
  }

  if (basePackageIndex === -1) {
    const firstPackageWithOptionsIndex = items.findIndex((pkg) => pkg.priceOptions.length > 0);
    if (firstPackageWithOptionsIndex === -1) return items;
    basePackageIndex = firstPackageWithOptionsIndex;
    baseOptionIndex = 0;
  }

  return items.map((pkg, pkgIndex) => ({
    ...pkg,
    priceOptions: pkg.priceOptions.map((option, optionIndex) => ({
      ...option,
      isBase: pkgIndex === basePackageIndex && optionIndex === baseOptionIndex,
    })),
  }));
}

function buildEditorTourPackages(items: unknown, legacyPriceOptions?: unknown, legacyPrice?: number): TourPackageEditor[] {
  const normalizedFromPackages = Array.isArray(items)
    ? items
    .map((item, index) => {
      const source = item as {
        id?: unknown;
        title?: unknown;
        description?: unknown;
        priceOptions?: unknown;
      };

      const id = String(source?.id ?? `pkg-${index}-${Date.now()}`).trim() || `pkg-${index}-${Date.now()}`;
      const title = String(source?.title ?? "").trim();
      const description = String(source?.description ?? "").trim();
      const options = buildEditorPriceOptions(source?.priceOptions);

      return {
        id,
        title,
        description,
        priceOptions: options,
      };
    })
    .filter((pkg) => pkg.title.length > 0 || pkg.priceOptions.some((option) => option.name.length > 0))
    : [];

  if (normalizedFromPackages.length > 0) return ensureSingleBaseAcrossEditorPackages(normalizedFromPackages);

  const legacyOptions = preparePriceOptionsForPayload(buildEditorPriceOptions(legacyPriceOptions));
  if (legacyOptions.length > 0) {
    return [
      {
        id: `pkg-legacy-${Date.now()}`,
        title: "Paquete principal",
        description: "",
        priceOptions: legacyOptions.map((option) => ({ ...option })),
      },
    ];
  }

  const fallbackLegacyPrice = Number.isFinite(Number(legacyPrice)) && Number(legacyPrice) > 0 ? Number(legacyPrice) : null;
  if (fallbackLegacyPrice !== null) {
    return [
      {
        id: `pkg-legacy-${Date.now()}`,
        title: "Paquete principal",
        description: "",
        priceOptions: [
          {
            id: "default-general",
            name: "General",
            price: fallbackLegacyPrice,
            isFree: false,
            isBase: true,
          },
        ],
      },
    ];
  }

  return [createEmptyTourPackage("Paquete principal")];
}

function preparePriceOptionsForPayload(items: PriceOptionEditor[]): Array<{ id: string; name: string; isFree: boolean; isBase: boolean; price: number }> {
  const preparedRaw = items
    .map((item) => ({
      id: String(item.id || "").trim(),
      name: item.name.trim(),
      isFree: item.isFree,
      isBase: item.isBase,
      price: item.isFree ? 0 : parseLooseDecimal(item.price),
    }))
    .filter((item) => item.id && item.name && (item.isFree || (item.price !== null && item.price > 0)))
    .map((item) => ({
      ...item,
      price: item.isFree ? 0 : roundPriceToTwo(item.price as number),
    }));

  return preparedRaw;
}

function getPrimaryPriceFromPackages(
  items: Array<{ priceOptions: Array<{ price: number; isFree: boolean; isBase: boolean }> }>,
  fallbackPrice = 0,
): number {
  for (const pkg of items) {
    const baseOption = pkg.priceOptions.find((option) => option.isBase);
    if (baseOption) return baseOption.isFree ? 0 : baseOption.price;
  }

  const firstPackageWithOptions = items.find((pkg) => pkg.priceOptions.length > 0);
  if (!firstPackageWithOptions) return fallbackPrice;

  const fallbackOption = firstPackageWithOptions.priceOptions[0];
  if (!fallbackOption) return fallbackPrice;
  return fallbackOption.isFree ? 0 : fallbackOption.price;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getStoredFilterConfig(): FilterConfig {
  if (typeof window === "undefined") return defaultFilterConfig;

  const stored = safeParse<FilterConfig>(localStorage.getItem(FILTER_CONFIG_KEY), defaultFilterConfig);
  return { ...defaultFilterConfig, ...stored };
}

function sanitizeOpenPackageIds(
  openIds: string[],
  packages: TourPackageEditor[],
  openMode: "multiple" | "single",
): string[] {
  const validIds = openIds.filter((id) => packages.some((pkg) => pkg.id === id));
  if (!packages.length) return [];
  if (!validIds.length) return [packages[0].id];
  if (openMode === "single" && validIds.length > 1) return [validIds[0]];
  return validIds;
}

function normalizeCategory(input: CategoryInput): Category | null {
  const source = input?.category && typeof input.category === "object" ? input.category : input;
  const id = Number(source?.id);
  const name = String(source?.name ?? "").trim();
  const descriptionRaw = source?.description;
  const description = typeof descriptionRaw === "string" ? descriptionRaw : "";

  if (!Number.isFinite(id) || id <= 0 || !name) return null;
  return { id, name, description };
}

function notifyToursSync() {
  localStorage.setItem("toursDataVersion", String(Date.now()));
  window.dispatchEvent(new Event("tours-data-updated"));
}

function nextId(items: Array<{ id: number }>) {
  return items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
}

function parseMultilineList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatMultilineList(items?: string[]): string {
  return Array.isArray(items) && items.length ? items.join("\n") : "";
}

function sanitizeFaqs(items?: FaqItem[]): FaqItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
    .filter((item) => item.question && item.answer);
}

function toCsvCell(value: string): string {
  const safe = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/"/g, '""');
  return `"${safe}"`;
}

function getCsvTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function buildToursCsv(tours: TourAdminView[]): string {
  const headers = [
    "id",
    "title",
    "description",
    "price",
    "minPeople",
    "status",
    "isDeleted",
    "deletedAt",
    "featured",
    "categoryId",
    "categoryName",
    "country",
    "zone",
    "durationDays",
    "activityType",
    "difficulty",
    "guideType",
    "transport",
    "groups",
    "story",
    "includedItems",
    "recommendations",
    "faqs",
    "availability",
    "tourPackages",
    "images",
  ];

  const rows = tours.map((tour) => {
    const values = [
      String(tour.id ?? ""),
      tour.title ?? "",
      tour.description ?? "",
      Number.isFinite(Number(tour.price)) ? String(Number(tour.price)) : "",
      Number.isFinite(Number(tour.minPeople)) ? String(Number(tour.minPeople)) : "",
      tour.status ?? "",
      String(Boolean(tour.isDeleted)),
      tour.deletedAt ?? "",
      String(Boolean(tour.featured)),
      Number.isFinite(Number(tour.category?.id)) ? String(Number(tour.category?.id)) : "",
      tour.category?.name ?? "",
      tour.country ?? "",
      tour.zone ?? "",
      Number.isFinite(Number(tour.durationDays)) ? String(Number(tour.durationDays)) : "",
      tour.activityType ?? "",
      tour.difficulty ?? "",
      tour.guideType ?? "",
      tour.transport ?? "",
      tour.groups ?? "",
      JSON.stringify(Array.isArray(tour.story) ? tour.story : []),
      JSON.stringify(Array.isArray(tour.includedItems) ? tour.includedItems : []),
      JSON.stringify(Array.isArray(tour.recommendations) ? tour.recommendations : []),
      JSON.stringify(Array.isArray(tour.faqs) ? tour.faqs : []),
      JSON.stringify(Array.isArray(tour.availability) ? tour.availability : []),
      JSON.stringify(Array.isArray(tour.tourPackages) ? tour.tourPackages : []),
      JSON.stringify(
        Array.isArray(tour.images)
          ? tour.images
              .map((item) => String(item ?? "").trim())
              .filter((item) => item.length > 0 && !item.startsWith("data:"))
          : [],
      ),
    ];

    return values.map((value) => toCsvCell(String(value))).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
  return rows;
}

function parseFaqsCsv(text: string): FaqItem[] {
  const rows = parseCsvTable(text);
  if (!rows.length) return [];

  const firstLower = rows[0].join(",").toLowerCase();
  const dataRows = firstLower.includes("pregunta") && firstLower.includes("respuesta") ? rows.slice(1) : rows;

  const parsed = dataRows.map((row) => {
    const question = (row[0] ?? "").trim();
    const answer = (row[1] ?? "").trim();
    return { question, answer };
  });

  return sanitizeFaqs(parsed);
}

function parseToursCsv(text: string): Partial<TourAdminView>[] {
  const rows = parseCsvTable(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const get = (key: string) => (row[headers.indexOf(key)] ?? "").trim();

    const safeJson = (val: string, fallback: unknown = []) => {
      try { return JSON.parse(val); } catch { return fallback; }
    };

    return {
      title: get("title"),
      description: get("description"),
      price: Number(get("price")) || 0,
      minPeople: Number(get("minpeople")) || 1,
      status: (get("status") as TourStatus) || "BORRADOR",
      featured: get("featured") === "true",
      country: get("country"),
      zone: get("zone"),
      durationDays: Number(get("durationdays")) || undefined,
      activityType: get("activitytype"),
      difficulty: get("difficulty"),
      guideType: get("guidetype"),
      transport: get("transport"),
      groups: get("groups"),
      story: safeJson(get("story"), []),
      includedItems: safeJson(get("includeditems"), []),
      recommendations: safeJson(get("recommendations"), []),
      faqs: safeJson(get("faqs"), []),
      priceOptions: safeJson(get("priceoptions"), []),
      tourPackages: safeJson(get("tourpackages"), []),
      images: safeJson(get("images"), []),
      category: { id: Number(get("categoryid")) || 0, name: get("categoryname") ?? "" },
    };
  }).filter((t) => t.title);
}

function parseFaqsFromPipeText(text: string): FaqItem[] {
  const items = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [questionPart, ...answerParts] = line.split("|");
      return {
        question: (questionPart ?? "").trim(),
        answer: answerParts.join("|").trim(),
      };
    });

  return sanitizeFaqs(items);
}

const defaultAvailabilityItems: AvailabilityItem[] = [];

function sanitizeAvailabilityItems(items: unknown): AvailabilityItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const source = item as { id?: unknown; date?: unknown; maxPeople?: unknown; timeSlots?: unknown };
      const date = String(source?.date ?? "").trim();
      const maxPeople = Number(source?.maxPeople ?? 0);
      const idRaw = Number(source?.id);

      return {
        id: Number.isFinite(idRaw) ? idRaw : index + 1,
        date,
        maxPeople: Number.isFinite(maxPeople) && maxPeople > 0 ? Math.floor(maxPeople) : 0,
        timeSlots: normalizeTimeSlots(source?.timeSlots),
      } satisfies AvailabilityItem;
    })
    .filter((item) => item.date && item.maxPeople > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getEffectiveAvailability(tour: TourAdminView): AvailabilityItem[] {
  const sanitized = sanitizeAvailabilityItems(tour.availability);
  return sanitized;
}

function getEffectiveAvailabilityConfig(tour: TourAdminView, availabilityItems: AvailabilityItem[]): AvailabilityConfig {
  const base = normalizeAvailabilityConfig(tour.availabilityConfig);
  const mergedDateSchedules = {
    ...base.dateSchedules,
    ...buildDateSchedulesFromAvailability(availabilityItems),
  };

  return {
    ...base,
    dateSchedules: mergedDateSchedules,
  };
}

function orderImagesWithFeatured(images: string[], featuredImage: string | null): string[] {
  const sanitized = images.map((item) => item.trim()).filter(Boolean);
  if (!sanitized.length) return [];
  if (!featuredImage) return sanitized;

  const featuredIndex = sanitized.indexOf(featuredImage);
  if (featuredIndex === -1) return sanitized;

  const [featured] = sanitized.splice(featuredIndex, 1);
  return [featured, ...sanitized];
}

function AdminPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEditorRoute = pathname === "/admin/editor";

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [allTours, setAllTours] = useState<TourAdminView[]>([]);
  const [searchTour, setSearchTour] = useState("");
  const [activeTab, setActiveTab] = useState<TourTab>("ACTIVOS");
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const paginationScope = `${activeTab}|${searchTour}|${itemsPerPage}`;
  const [pagination, setPagination] = useState<{ scope: string; page: number }>(() => ({ scope: paginationScope, page: 1 }));
  const [isFilterConfigOpen, setIsFilterConfigOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const confirmCloseResolveRef = useRef<((value: boolean) => void) | null>(null);
  const [editorInitial, setEditorInitial] = useState<TourEditorState | null>(null);

  const [editingTourId, setEditingTourId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [minPeople, setMinPeople] = useState<number | "">(1);
  const [imageList, setImageList] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [country, setCountry] = useState("");
  const [zone, setZone] = useState("");
  const [departurePoint, setDeparturePoint] = useState("");
  const [durationDays, setDurationDays] = useState<number | "">("");
  const [activityType, setActivityType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [guideType, setGuideType] = useState("");
  const [transport, setTransport] = useState("");
  const [groups, setGroups] = useState("");
  const [storyText, setStoryText] = useState("");
  const [tourPackages, setTourPackages] = useState<TourPackageEditor[]>(() =>
    ensureSingleBaseAcrossEditorPackages([createEmptyTourPackage("Paquete principal")]),
  );
  const [packageOpenMode, setPackageOpenMode] = useState<"multiple" | "single">("multiple");
  const [openPackageIds, setOpenPackageIds] = useState<string[]>([]);
  const [includedText, setIncludedText] = useState("");
  const [recommendationsText, setRecommendationsText] = useState("");
  const [faqsList, setFaqsList] = useState<FaqItem[]>([]);
  const [faqQuestionInput, setFaqQuestionInput] = useState("");
  const [faqAnswerInput, setFaqAnswerInput] = useState("");
  const [availabilityList, setAvailabilityList] = useState<AvailabilityItem[]>([]);
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>("SPECIFIC");
  const [openSchedule, setOpenSchedule] = useState<OpenScheduleConfig>(defaultOpenSchedule);
  const [availabilityDateInput, setAvailabilityDateInput] = useState("");
  const [availabilityMaxPeopleInput, setAvailabilityMaxPeopleInput] = useState<number | "">(8);
  const [availabilityUseCustomTimesInput, setAvailabilityUseCustomTimesInput] = useState(false);
  const [availabilityCustomTimesInput, setAvailabilityCustomTimesInput] = useState("");
  const [availabilityStartTimeInput, setAvailabilityStartTimeInput] = useState("08:00");
  const [availabilityEndTimeInput, setAvailabilityEndTimeInput] = useState("17:00");
  const [availabilityIntervalInput, setAvailabilityIntervalInput] = useState<number | "">("");
  const [openManualHourInput, setOpenManualHourInput] = useState("08");
  const [openManualMinuteInput, setOpenManualMinuteInput] = useState("00");
  const [specificManualHourInput, setSpecificManualHourInput] = useState("08");
  const [specificManualMinuteInput, setSpecificManualMinuteInput] = useState("00");
  const [isFaqBulkOpen, setIsFaqBulkOpen] = useState(false);
  const [faqBulkText, setFaqBulkText] = useState("");
  const [isGalleryDragActive, setIsGalleryDragActive] = useState(false);
  const [isGalleryUploading, setIsGalleryUploading] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isMediaPickerLoading, setIsMediaPickerLoading] = useState(false);
  const [mediaPickerSearch, setMediaPickerSearch] = useState("");
  const [mediaLibraryItems, setMediaLibraryItems] = useState<AdminMediaItem[]>([]);
  const [selectedMediaUrls, setSelectedMediaUrls] = useState<string[]>([]);
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const faqCsvInputRef = useRef<HTMLInputElement | null>(null);
  const importToursCsvRef = useRef<HTMLInputElement | null>(null);
  const quickCsvInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<TourStatus>("BORRADOR");
  const [featured, setFeatured] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [inlineCategoryName, setInlineCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryDescription, setEditingCategoryDescription] = useState("");

  const [filterConfig, setFilterConfig] = useState<FilterConfig>(() => getStoredFilterConfig());
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedTourIds, setSelectedTourIds] = useState<number[]>([]);
  const [isSavingTour, setIsSavingTour] = useState(false);
  const [isSavingFilterConfig, setIsSavingFilterConfig] = useState(false);
  const [isSavingCategoryEdit, setIsSavingCategoryEdit] = useState(false);

  const previewSpecificSlots = useMemo(() => {
    if (availabilityUseCustomTimesInput) return parseCustomTimeSlots(availabilityCustomTimesInput);
    return buildIntervalTimeSlots(
      availabilityStartTimeInput,
      availabilityEndTimeInput,
      Number(availabilityIntervalInput || 0),
    );
  }, [availabilityCustomTimesInput, availabilityEndTimeInput, availabilityIntervalInput, availabilityStartTimeInput, availabilityUseCustomTimesInput]);

  const previewOpenSlots = useMemo(() => buildTimeSlotsFromSchedule(openSchedule), [openSchedule]);

  const hasSpecificScheduleConfigured = useMemo(() => {
    if (availabilityUseCustomTimesInput) {
      return parseCustomTimeSlots(availabilityCustomTimesInput).length > 0;
    }

    return availabilityIntervalInput !== "" && previewSpecificSlots.length > 0;
  }, [availabilityCustomTimesInput, availabilityIntervalInput, availabilityUseCustomTimesInput, previewSpecificSlots]);

  const mediaPickerVisibleItems = useMemo(() => {
    const query = mediaPickerSearch.trim().toLowerCase();
    const activeImages = mediaLibraryItems.filter((item) => item.status === "active" && item.isImage && Boolean(item.url));
    if (!query) return activeImages;
    return activeImages.filter((item) => `${item.name} ${item.url}`.toLowerCase().includes(query));
  }, [mediaLibraryItems, mediaPickerSearch]);

  useEffect(() => {
    if (status !== "BORRADOR") return;
    setSlug(slugifyTourValue(title));
  }, [status, title]);

  const setCurrentPage = (value: number | ((prev: number) => number)) => {
    setPagination((prev) => {
      const basePage = prev.scope === paginationScope ? prev.page : 1;
      const nextPage = typeof value === "function" ? value(basePage) : value;

      return {
        scope: paginationScope,
        page: Math.max(1, nextPage),
      };
    });
  };

  const createEmptyEditorState = (defaultCategoryId: number | null): TourEditorState => ({
    editingTourId: null,
    title: "",
    slug: "",
    description: "",
    minPeople: 1,
    imageList: [],
    categoryId: defaultCategoryId,
    country: "",
    zone: "",
    departurePoint: "",
    durationDays: "",
    activityType: "",
    difficulty: "",
    guideType: "",
    transport: "",
    groups: "",
    storyText: "",
    tourPackages: ensureSingleBaseAcrossEditorPackages([createEmptyTourPackage("Paquete principal")]),
    includedText: "",
    recommendationsText: "",
    faqsList: [],
    availabilityList: defaultAvailabilityItems,
    availabilityConfig: defaultAvailabilityConfig,
    status: "BORRADOR",
    featured: false,
  });

  const applyEditorState = (state: TourEditorState) => {
    setEditingTourId(state.editingTourId);
    setTitle(state.title);
    setSlug(state.slug);
    setDescription(state.description);
    setMinPeople(state.minPeople);
    setImageList(state.imageList);
    setFeaturedImageUrl(state.imageList[0] ?? null);
    setCategoryId(state.categoryId);
    setCountry(state.country);
    setZone(state.zone);
    setDeparturePoint(state.departurePoint);
    setDurationDays(state.durationDays);
    setActivityType(state.activityType);
    setDifficulty(state.difficulty);
    setGuideType(state.guideType);
    setTransport(state.transport);
    setGroups(state.groups);
    setStoryText(state.storyText);
    setTourPackages(ensureSingleBaseAcrossEditorPackages(state.tourPackages));
    setOpenPackageIds(state.tourPackages.map((pkg) => pkg.id));
    setIncludedText(state.includedText);
    setRecommendationsText(state.recommendationsText);
    setFaqsList(state.faqsList);
    setAvailabilityList(state.availabilityList);
    setAvailabilityMode(state.availabilityConfig.mode);
    setOpenSchedule(state.availabilityConfig.openSchedule);
    setFaqQuestionInput("");
    setFaqAnswerInput("");
    setAvailabilityDateInput("");
    setAvailabilityMaxPeopleInput(8);
    setAvailabilityUseCustomTimesInput(false);
    setAvailabilityCustomTimesInput("");
    setAvailabilityStartTimeInput("08:00");
    setAvailabilityEndTimeInput("17:00");
    setAvailabilityIntervalInput("");
    setOpenManualHourInput("08");
    setOpenManualMinuteInput("00");
    setSpecificManualHourInput("08");
    setSpecificManualMinuteInput("00");
    setStatus(state.status);
    setFeatured(state.featured);
  };

  const currentEditorState: TourEditorState = {
    editingTourId,
    title,
    slug,
    description,
    minPeople: minPeople === "" ? 1 : minPeople,
    imageList,
    categoryId,
    country,
    zone,
    departurePoint,
    durationDays,
    activityType,
    difficulty,
    guideType,
    transport,
    groups,
    storyText,
    tourPackages,
    includedText,
    recommendationsText,
    faqsList,
    availabilityList,
    availabilityConfig: {
      mode: availabilityMode,
      openSchedule: normalizeOpenScheduleConfig(openSchedule),
      dateSchedules: buildDateSchedulesFromAvailability(availabilityList),
    },
    status,
    featured,
  };

  const editorHasChanges = Boolean(
    isEditorOpen && editorInitial && JSON.stringify(currentEditorState) !== JSON.stringify(editorInitial),
  );

  const effectiveOpenPackageIds = useMemo(
    () => sanitizeOpenPackageIds(openPackageIds, tourPackages, packageOpenMode),
    [openPackageIds, packageOpenMode, tourPackages],
  );

  const validCategories = useMemo(() => {
    const uniqueCategories = new Map<number, Category>();

    categories.forEach((cat) => {
      const isValid = Number.isFinite(cat.id) && cat.id > 0 && typeof cat.name === "string" && cat.name.trim().length > 0;
      if (!isValid) return;
      if (uniqueCategories.has(cat.id)) return;
      uniqueCategories.set(cat.id, cat);
    });

    return Array.from(uniqueCategories.values());
  }, [categories]);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsAuthChecking(false));
  }, []);

  const loadData = useCallback(async () => {
    const localCategoriesRaw = safeParse<CategoryInput[]>(localStorage.getItem(LOCAL_CATEGORIES_KEY), []);
    const localCategories = localCategoriesRaw
      .map((category) => normalizeCategory(category))
      .filter((category): category is Category => category !== null);
    const localTours = safeParse<TourAdminView[]>(localStorage.getItem(LOCAL_TOURS_KEY), []);
    const localCreatedAtById = new Map<number, string>();
    localTours.forEach((tour) => {
      if (typeof tour.createdAt === "string" && tour.createdAt.trim()) {
        localCreatedAtById.set(tour.id, tour.createdAt.trim());
      }
    });

    Promise.all([fetch("/api/categories").then((res) => res.json()), fetch("/api/tours").then((res) => res.json())])
      .then(([apiCategories, apiTours]) => {
        const remoteCategories: Category[] = Array.isArray(apiCategories)
          ? apiCategories
              .map((category) => normalizeCategory(category as CategoryInput))
              .filter((category): category is Category => category !== null)
          : [];

        const categoriesMap = new Map<number, Category>();
        [...fallbackCategories, ...remoteCategories].forEach((category) => categoriesMap.set(category.id, category));
        const mergedCategories = Array.from(categoriesMap.values());
        setCategories(mergedCategories);
        if (!categoryId && mergedCategories[0]) setCategoryId(mergedCategories[0].id);

        const remoteToursRaw: TourAdminView[] = Array.isArray(apiTours)
          ? apiTours.map((tour: TourAdminView) => {
              const normalizedAvailability = sanitizeAvailabilityItems(tour.availability);
              const normalizedAvailabilityConfig = getEffectiveAvailabilityConfig(tour, normalizedAvailability);

              return {
                ...tour,
                createdAt:
                  typeof tour.createdAt === "string" && tour.createdAt.trim()
                    ? tour.createdAt
                    : localCreatedAtById.get(tour.id) ?? null,
                status: tour.status ?? "BORRADOR",
                isDeleted: Boolean(tour.isDeleted),
                deletedAt: tour.deletedAt ?? null,
                country: tour.country ?? "",
                zone: tour.zone ?? "",
                activityType: tour.activityType ?? "",
                difficulty: tour.difficulty ?? "",
                durationDays: tour.durationDays ?? undefined,
                availability: applyDateSchedulesToAvailability(normalizedAvailability, normalizedAvailabilityConfig.dateSchedules),
                availabilityConfig: normalizedAvailabilityConfig,
                tourPackages: buildEditorTourPackages(
                  (tour as { tourPackages?: unknown }).tourPackages,
                  (tour as { priceOptions?: unknown }).priceOptions,
                  tour.price,
                ),
                featured: tour.featured ?? false,
                minPeople: Number.isFinite(Number(tour.minPeople)) && Number(tour.minPeople) > 0 ? Number(tour.minPeople) : 1,
              };
            })
          : [];

        const remoteTours = sortToursByRecent(remoteToursRaw);

        setAllTours(remoteTours);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(mergedCategories));
        localStorage.setItem(LOCAL_TOURS_KEY, JSON.stringify(remoteTours));
      })
      .catch(() => {
        const categoriesFallback = localCategories.length ? localCategories : fallbackCategories;
        setCategories(categoriesFallback);
        if (!categoryId && categoriesFallback[0]) setCategoryId(categoriesFallback[0].id);
        setAllTours(sortToursByRecent(localTours));
      });
  }, [categoryId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated, loadData]);

  const effectiveSelectedTourIds = useMemo(
    () => selectedTourIds.filter((id) => allTours.some((tour) => tour.id === id)),
    [allTours, selectedTourIds],
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });

      if (!res.ok) {
        setLoginError("Usuario o contrasena incorrectos.");
        return;
      }

      setIsAuthenticated(true);
      setLoginError("");
    } catch {
      setLoginError("No se pudo iniciar sesion. Intenta nuevamente.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch {
      // If logout request fails, force local logout state anyway.
    }
    setIsAuthenticated(false);
    setLoginUser("");
    setLoginPass("");
  };

  const addImageUrlsToTour = useCallback((urls: string[]) => {
    const cleanUrls = urls.map((item) => String(item || "").trim()).filter(Boolean);
    if (!cleanUrls.length) return;

    setImageList((prev) => {
      const next = Array.from(new Set([...prev, ...cleanUrls]));
      setFeaturedImageUrl((currentFeatured) => (currentFeatured && next.includes(currentFeatured) ? currentFeatured : next[0] ?? null));
      return next;
    });
  }, []);

  const loadMediaLibraryItems = useCallback(async () => {
    setIsMediaPickerLoading(true);
    try {
      const res = await fetch("/api/admin/media");
      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        setFeedback({ type: "error", message: "No se pudo cargar la biblioteca de medios." });
        return;
      }

      const payload = (await res.json().catch(() => null)) as AdminMediaApiResponse | null;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setMediaLibraryItems(items);
    } catch {
      setFeedback({ type: "error", message: "Error de red al cargar la biblioteca de medios." });
    } finally {
      setIsMediaPickerLoading(false);
    }
  }, []);

  const openMediaPicker = async () => {
    setIsMediaPickerOpen(true);
    setSelectedMediaUrls([]);
    if (mediaLibraryItems.length === 0) {
      await loadMediaLibraryItems();
    }
  };

  const handleUploadImages = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("images", file));

    setIsGalleryUploading(true);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const detail = typeof errorData?.detail === "string" ? ` (${errorData.detail})` : "";
        setFeedback({ type: "error", message: `${errorData?.error || "No se pudieron subir las imagenes."}${detail}` });
        return;
      }

      const payload = await res.json().catch(() => null);
      const urls = Array.isArray(payload?.urls)
        ? payload.urls.map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
        : [];

      if (!urls.length) {
        setFeedback({ type: "error", message: "No se recibieron URLs validas de imagen." });
        return;
      }

      addImageUrlsToTour(urls);
      setFeedback({ type: "success", message: `Se subieron ${urls.length} imagenes a /uploads/tours.` });
    } catch {
      setFeedback({ type: "error", message: "Error de conexion al subir imagenes." });
    } finally {
      setIsGalleryUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImageList((prev) => {
      const removedImage = prev[index] ?? null;
      const next = prev.filter((_, i) => i !== index);

      setFeaturedImageUrl((currentFeatured) => {
        if (!next.length) return null;
        if (currentFeatured && next.includes(currentFeatured) && currentFeatured !== removedImage) return currentFeatured;
        return next[0];
      });

      return next;
    });
  };

  const clearAllImages = () => {
    setImageList([]);
    setFeaturedImageUrl(null);
  };

  const openGalleryPicker = () => {
    galleryInputRef.current?.click();
  };

  const toggleMediaSelection = (url: string, checked: boolean) => {
    const normalized = String(url || "").trim();
    if (!normalized) return;

    setSelectedMediaUrls((prev) => {
      if (checked) return Array.from(new Set([...prev, normalized]));
      return prev.filter((item) => item !== normalized);
    });
  };

  const addSelectedMediaToTour = () => {
    if (!selectedMediaUrls.length) {
      setFeedback({ type: "error", message: "Selecciona al menos una imagen de la biblioteca." });
      return;
    }

    addImageUrlsToTour(selectedMediaUrls);
    setSelectedMediaUrls([]);
    setIsMediaPickerOpen(false);
    setFeedback({ type: "success", message: `${selectedMediaUrls.length} imagen(es) agregada(s) desde la biblioteca.` });
  };

  const handleGalleryDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isGalleryDragActive) setIsGalleryDragActive(true);
  };

  const handleGalleryDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsGalleryDragActive(false);
  };

  const handleGalleryDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isGalleryUploading) return;
    setIsGalleryDragActive(false);
    void handleUploadImages(e.dataTransfer.files);
  };

  const resetTourForm = () => {
    setEditingTourId(null);
    setTitle("");
    setSlug("");
    setDescription("");
    setMinPeople(1);
    setImageList([]);
    setFeaturedImageUrl(null);
    setCountry("");
    setZone("");
    setDurationDays("");
    setActivityType("");
    setDifficulty("");
    setGuideType("");
    setTransport("");
    setGroups("");
    setStoryText("");
    const defaultPackage = createEmptyTourPackage("Paquete principal");
    setTourPackages(ensureSingleBaseAcrossEditorPackages([defaultPackage]));
    setOpenPackageIds([defaultPackage.id]);
    setPackageOpenMode("multiple");
    setIncludedText("");
    setRecommendationsText("");
    setFaqsList([]);
    setAvailabilityList(defaultAvailabilityItems);
    setAvailabilityMode("SPECIFIC");
    setOpenSchedule(defaultOpenSchedule);
    setFaqQuestionInput("");
    setFaqAnswerInput("");
    setAvailabilityDateInput("");
    setAvailabilityMaxPeopleInput(8);
    setAvailabilityUseCustomTimesInput(false);
    setAvailabilityCustomTimesInput("");
    setAvailabilityStartTimeInput("08:00");
    setAvailabilityEndTimeInput("17:00");
    setAvailabilityIntervalInput("");
    setOpenManualHourInput("08");
    setOpenManualMinuteInput("00");
    setSpecificManualHourInput("08");
    setSpecificManualMinuteInput("00");
    setStatus("BORRADOR");
    setFeatured(false);
    if (categories[0]) setCategoryId(categories[0].id);
  };

  const handleAddTourPackage = () => {
    const nextPackage = createEmptyTourPackage();
    setTourPackages((prev) => ensureSingleBaseAcrossEditorPackages([...prev, nextPackage]));
    setOpenPackageIds((prev) => {
      if (packageOpenMode === "single") return [nextPackage.id];
      return [...prev, nextPackage.id];
    });
  };

  const handleRemoveTourPackage = (packageId: string) => {
    setTourPackages((prev) => ensureSingleBaseAcrossEditorPackages(prev.filter((pkg) => pkg.id !== packageId)));
    setOpenPackageIds((prev) => prev.filter((id) => id !== packageId));
  };

  const togglePackageExpanded = (packageId: string) => {
    setOpenPackageIds((prev) => {
      const currentOpenIds = sanitizeOpenPackageIds(prev, tourPackages, packageOpenMode);
      const isCurrentlyOpen = currentOpenIds.includes(packageId);
      if (isCurrentlyOpen) return currentOpenIds.filter((id) => id !== packageId);
      if (packageOpenMode === "single") return [packageId];
      return [...currentOpenIds, packageId];
    });
  };

  const handleExpandAllPackages = () => {
    setPackageOpenMode("multiple");
    setOpenPackageIds(tourPackages.map((pkg) => pkg.id));
  };

  const handleCollapseAllPackages = () => {
    setOpenPackageIds([]);
  };

  const handlePackageMetaChange = (packageId: string, field: "title" | "description", value: string) => {
    setTourPackages((prev) =>
      prev.map((pkg) => (pkg.id === packageId ? { ...pkg, [field]: value } : pkg)),
    );
  };

  const handlePackagePriceOptionChange = (packageId: string, optionId: string, field: "name" | "price", value: string) => {
    setTourPackages((prev) =>
      prev.map((pkg) => {
        if (pkg.id !== packageId) return pkg;
        const nextOptions = pkg.priceOptions.map((option) => {
          if (option.id !== optionId) return option;
          if (field === "name") return { ...option, name: value };
          return { ...option, price: parseEditorPriceInput(value) };
        });
        return { ...pkg, priceOptions: nextOptions };
      }),
    );
  };

  const handlePackageTogglePriceOptionFree = (packageId: string, optionId: string, checked: boolean) => {
    setTourPackages((prev) =>
      prev.map((pkg) => {
        if (pkg.id !== packageId) return pkg;
        const nextOptions = pkg.priceOptions.map((option) =>
          option.id === optionId ? { ...option, isFree: checked, price: checked ? 0 : normalizeUnfreePrice(option.price) } : option,
        );
        return { ...pkg, priceOptions: nextOptions };
      }),
    );
  };

  const handlePackageSetPriceOptionAsBase = (packageId: string, optionId: string) => {
    setTourPackages((prev) =>
      prev.map((pkg) => {
        return {
          ...pkg,
          priceOptions: pkg.priceOptions.map((option) => ({
            ...option,
            isBase: pkg.id === packageId && option.id === optionId,
          })),
        };
      }),
    );
  };

  const handlePackageAddCustomPriceOption = (packageId: string) => {
    const customId = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setTourPackages((prev) =>
      prev.map((pkg) =>
        pkg.id === packageId
          ? { ...pkg, priceOptions: [...pkg.priceOptions, { id: customId, name: "", price: "", isFree: false, isBase: false }] }
          : pkg,
      ),
    );
  };

  const handlePackageRemoveCustomPriceOption = (packageId: string, optionId: string) => {
    if (!optionId.startsWith("custom-")) return;
    setTourPackages((prev) =>
      ensureSingleBaseAcrossEditorPackages(prev.map((pkg) =>
        pkg.id === packageId
          ? { ...pkg, priceOptions: pkg.priceOptions.filter((option) => option.id !== optionId) }
          : pkg,
      )),
    );
  };

  const handleAddFaq = () => {
    const question = faqQuestionInput.trim();
    const answer = faqAnswerInput.trim();
    if (!question || !answer) {
      setFeedback({ type: "error", message: "Completa pregunta y respuesta para agregar una FAQ." });
      return;
    }

    setFaqsList((prev) => [...prev, { question, answer }]);
    setFaqQuestionInput("");
    setFaqAnswerInput("");
  };

  const handleRemoveFaq = (index: number) => {
    setFaqsList((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAddOpenManualTime = () => {
    const nextSlot = `${openManualHourInput}:${openManualMinuteInput}`;
    const parsed = normalizeTime24(nextSlot);
    if (!parsed) return;

    const nextSlots = Array.from(new Set([...parseCustomTimeSlots(openSchedule.customTimesText), parsed])).sort();
    setOpenSchedule((prev) => ({
      ...prev,
      customTimesText: nextSlots.join(", "),
    }));
  };

  const handleRemoveOpenManualTime = (slotToRemove: string) => {
    const nextSlots = parseCustomTimeSlots(openSchedule.customTimesText).filter((slot) => slot !== slotToRemove);
    setOpenSchedule((prev) => ({
      ...prev,
      customTimesText: nextSlots.join(", "),
    }));
  };

  const handleAddSpecificManualTime = () => {
    const nextSlot = `${specificManualHourInput}:${specificManualMinuteInput}`;
    const parsed = normalizeTime24(nextSlot);
    if (!parsed) return;

    const nextSlots = Array.from(new Set([...parseCustomTimeSlots(availabilityCustomTimesInput), parsed])).sort();
    setAvailabilityCustomTimesInput(nextSlots.join(", "));
  };

  const handleRemoveSpecificManualTime = (slotToRemove: string) => {
    const nextSlots = parseCustomTimeSlots(availabilityCustomTimesInput).filter((slot) => slot !== slotToRemove);
    setAvailabilityCustomTimesInput(nextSlots.join(", "));
  };

  const handleAddAvailability = () => {
    if (!hasSpecificScheduleConfigured) {
      setFeedback({ type: "error", message: "Define los horarios de la fecha antes de agregarla." });
      return;
    }

    if (!availabilityDateInput) {
      setFeedback({ type: "error", message: "Selecciona una fecha para disponibilidad." });
      return;
    }

    const maxPeople = Number(availabilityMaxPeopleInput || 0);
    if (!Number.isFinite(maxPeople) || maxPeople <= 0) {
      setFeedback({ type: "error", message: "Ingresa un cupo valido para la fecha." });
      return;
    }

    const isoDate = new Date(`${availabilityDateInput}T09:00:00.000Z`).toISOString();
    const keyDate = isoDate.slice(0, 10);
    const nextTimeSlots = previewSpecificSlots;

    const existing = availabilityList.find((item) => item.date.slice(0, 10) === keyDate);
    if (existing) {
      setAvailabilityList((prev) =>
        prev.map((item) => (item.id === existing.id ? { ...item, maxPeople, timeSlots: nextTimeSlots } : item)),
      );
      setAvailabilityDateInput("");
      setAvailabilityMaxPeopleInput(8);
      setAvailabilityUseCustomTimesInput(false);
      setAvailabilityCustomTimesInput("");
      setAvailabilityIntervalInput("");
      setSpecificManualHourInput("08");
      setSpecificManualMinuteInput("00");
      return;
    }

    const nextId = availabilityList.length
      ? Math.max(...availabilityList.map((item) => item.id)) + 1
      : 1;
    setAvailabilityList((prev) => [...prev, { id: nextId, date: isoDate, maxPeople, timeSlots: nextTimeSlots }]);
    setAvailabilityDateInput("");
    setAvailabilityMaxPeopleInput(8);
    setAvailabilityUseCustomTimesInput(false);
    setAvailabilityCustomTimesInput("");
    setAvailabilityIntervalInput("");
    setSpecificManualHourInput("08");
    setSpecificManualMinuteInput("00");
  };

  const handleRemoveAvailability = (itemId: number) => {
    setAvailabilityList((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleDownloadFaqCsv = () => {
    const sanitized = sanitizeFaqs(faqsList);
    const header = "Pregunta,Respuesta";
    const rows = sanitized.map((faq) => `${toCsvCell(faq.question)},${toCsvCell(faq.answer)}`);
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "preguntas-frecuentes.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleTourSelection = (tourId: number) => {
    setSelectedTourIds((prev) =>
      prev.includes(tourId)
        ? prev.filter((id) => id !== tourId)
        : [...prev.filter((id) => allTours.some((tour) => tour.id === id)), tourId],
    );
  };

  const handleToggleSelectPageTours = (checked: boolean) => {
    const currentIds = paginatedTours.map((tour) => tour.id);
    setSelectedTourIds((prev) => {
      const baseSelection = prev.filter((id) => allTours.some((tour) => tour.id === id));
      if (checked) {
        return Array.from(new Set([...baseSelection, ...currentIds]));
      }
      return baseSelection.filter((id) => !currentIds.includes(id));
    });
  };

  const handleImportToursCsv = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseToursCsv(text);

    if (!parsed.length) {
      setFeedback({ type: "error", message: "No se encontraron tours validos en el CSV." });
      return;
    }

    const confirm = window.confirm(`Se importaran ${parsed.length} tours. Los tours se crearan como nuevos (sin reemplazar los existentes). Continuar?`);
    if (!confirm) return;

    setFeedback({ type: "success", message: `Importando ${parsed.length} tours...` });

    let ok = 0;
    let fail = 0;
    const failureDetails: string[] = [];

    for (const tour of parsed) {
      try {
        const normalizedPackages = buildEditorTourPackages(
          tour.tourPackages,
          (tour as { priceOptions?: unknown }).priceOptions,
          Number(tour.price),
        );

        const res = await fetch("/api/admin/tour", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: tour.title,
            description: tour.description,
            price: tour.price,
            minPeople: tour.minPeople ?? 1,
            status: tour.status ?? "BORRADOR",
            featured: tour.featured ?? false,
            country: tour.country,
            zone: tour.zone,
            durationDays: tour.durationDays,
            activityType: tour.activityType,
            difficulty: tour.difficulty,
            guideType: tour.guideType,
            transport: tour.transport,
            groups: tour.groups,
            story: tour.story ?? [],
            includedItems: tour.includedItems ?? [],
            recommendations: tour.recommendations ?? [],
            faqs: tour.faqs ?? [],
            tourPackages: normalizedPackages,
            images: tour.images ?? [],
            categoryId: tour.category?.id,
          }),
        });
        if (res.ok) {
          ok++;
        } else {
          fail++;
          if (failureDetails.length < 3) {
            const errorPayload = await res.json().catch(() => null);
            const detail =
              (errorPayload && typeof errorPayload.error === "string" && errorPayload.error) ||
              (errorPayload && typeof errorPayload.detail === "string" && errorPayload.detail) ||
              `HTTP ${res.status}`;
            failureDetails.push(`${tour.title ?? "Tour sin titulo"}: ${detail}`);
          }
        }
      } catch {
        fail++;
        if (failureDetails.length < 3) {
          failureDetails.push(`${tour.title ?? "Tour sin titulo"}: Error de red o servidor.`);
        }
      }
    }

    await loadData();
    const detailText = failureDetails.length ? ` Detalle: ${failureDetails.join(" | ")}` : "";
    setFeedback({
      type: ok > 0 ? "success" : "error",
      message: `Importacion completada: ${ok} creados${fail > 0 ? `, ${fail} fallaron` : ""}.${detailText}`,
    });
    if (importToursCsvRef.current) importToursCsvRef.current.value = "";
  };

  const handleExportToursCsv = (mode: "all" | "selected") => {
    const toursToExport = mode === "all" ? allTours : allTours.filter((tour) => effectiveSelectedTourIds.includes(tour.id));

    if (toursToExport.length === 0) {
      setFeedback({
        type: "error",
        message: mode === "selected" ? "Selecciona al menos un tour para exportar." : "No hay tours para exportar.",
      });
      return;
    }

    const csv = buildToursCsv(toursToExport);
    const timestamp = getCsvTimestamp();
    const suffix = mode === "all" ? "todos" : "seleccionados";
    downloadCsv(csv, `tours-${suffix}-${timestamp}.csv`);
    setFeedback({
      type: "success",
      message: `Se exportaron ${toursToExport.length} tours a CSV.`,
    });
  };

  const handleImportQuickCsv = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const text = await file.text();
    if (!text.trim()) {
      setFeedback({ type: "error", message: "El archivo CSV rapido esta vacio." });
      return;
    }

    setFeedback({ type: "success", message: "Importando CSV rapido..." });

    try {
      const res = await fetch("/api/admin/tours-csv-quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", message: payload?.error || "No se pudo importar el CSV rapido." });
        return;
      }

      await loadData();
      setFeedback({
        type: "success",
        message: `CSV rapido importado: ${Number(payload?.created ?? 0)} creados, ${Number(payload?.updated ?? 0)} actualizados${Number(payload?.skipped ?? 0) > 0 ? `, ${Number(payload?.skipped ?? 0)} omitidos` : ""}.`,
      });
    } catch {
      setFeedback({ type: "error", message: "Error de red al importar CSV rapido." });
    } finally {
      if (quickCsvInputRef.current) quickCsvInputRef.current.value = "";
    }
  };

  const handleExportQuickCsv = async () => {
    try {
      const res = await fetch("/api/admin/tours-csv-quick");
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setFeedback({ type: "error", message: payload?.error || "No se pudo exportar el CSV rapido." });
        return;
      }

      const csv = await res.text();
      const timestamp = getCsvTimestamp();
      downloadCsv(csv, `tours-quick-format-${timestamp}.csv`);
      setFeedback({ type: "success", message: "CSV rapido exportado correctamente." });
    } catch {
      setFeedback({ type: "error", message: "Error de red al exportar CSV rapido." });
    }
  };

  const handleImportFaqCsv = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseFaqsCsv(text);
    if (!parsed.length) {
      setFeedback({ type: "error", message: "No se encontraron FAQs validas en el CSV." });
      return;
    }

    if (faqsList.length > 0) {
      const confirmReplace = window.confirm("Esta accion reemplazara las FAQs actuales. Deseas continuar?");
      if (!confirmReplace) return;
    }

    setFaqsList(parsed);
    setFeedback({ type: "success", message: `Se cargaron ${parsed.length} FAQs desde CSV.` });
  };

  const handleApplyFaqBulkInput = () => {
    const parsed = parseFaqsFromPipeText(faqBulkText);
    if (!parsed.length) {
      setFeedback({ type: "error", message: "No hay lineas validas. Usa formato: Pregunta | Respuesta" });
      return;
    }

    if (faqsList.length > 0) {
      const confirmReplace = window.confirm("Esta carga masiva reemplazara las FAQs actuales. Deseas continuar?");
      if (!confirmReplace) return;
    }

    setFaqsList(parsed);
    setFaqBulkText("");
    setIsFaqBulkOpen(false);
    setFeedback({ type: "success", message: `Se cargaron ${parsed.length} FAQs desde entrada masiva.` });
  };

  const openCreateTour = () => {
    const fresh = createEmptyEditorState(categories[0]?.id ?? null);
    applyEditorState(fresh);
    setEditorInitial(fresh);
    setInlineCategoryName("");
    setIsEditorOpen(true);
  };

  const openEditorRoute = (tourId?: number) => {
    const query = typeof tourId === "number" ? `?id=${tourId}` : "";
    router.push(`/admin/editor${query}`);
  };

  const saveToursLocal = (items: TourAdminView[]) => {
    try {
      const sortedItems = sortToursByRecent(items);
      setAllTours(sortedItems);
      localStorage.setItem(LOCAL_TOURS_KEY, JSON.stringify(sortedItems));
      notifyToursSync();
      return true;
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudo guardar el tour localmente. Intenta con imagenes mas ligeras.",
      });
      return false;
    }
  };

  const saveCategoriesLocal = (items: Category[]) => {
    try {
      setCategories(items);
      localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(items));
      notifyToursSync();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudieron guardar las categorias localmente." });
      return false;
    }
  };

  const handleCreateOrUpdateTour = async () => {
    if (isSavingTour) return false;

    const orderedImageList = orderImagesWithFeatured(imageList, featuredImageUrl);

    const category = categories.find((c) => c.id === categoryId);
    const payloadCategory = category ? { id: category.id, name: category.name } : { id: 0, name: "Sin categoria" };

    const normalizedTourPackages = ensureSingleBaseAcrossEditorPackages(tourPackages);

    const preparedTourPackages = normalizedTourPackages
      .map((pkg) => ({
        id: String(pkg.id || "").trim(),
        title: pkg.title.trim(),
        description: pkg.description.trim(),
        priceOptions: preparePriceOptionsForPayload(pkg.priceOptions),
      }))
      .filter((pkg) => pkg.id && pkg.title && pkg.priceOptions.length > 0);

    const effectiveBasePrice = getPrimaryPriceFromPackages(preparedTourPackages, 0);

    const normalizedAvailabilityList = sanitizeAvailabilityItems(availabilityList);
    const availabilityConfig: AvailabilityConfig = {
      mode: availabilityMode,
      openSchedule: normalizeOpenScheduleConfig(openSchedule),
      dateSchedules: buildDateSchedulesFromAvailability(normalizedAvailabilityList),
    };

    const payload = {
      title,
      slug: slugifyTourValue(slug || title),
      description,
      price: effectiveBasePrice,
      minPeople: Number.isFinite(Number(minPeople)) && Number(minPeople) > 0 ? Math.floor(Number(minPeople)) : 1,
      images: orderedImageList,
      category: payloadCategory,
      includedItems: parseMultilineList(includedText),
      recommendations: parseMultilineList(recommendationsText),
      faqs: sanitizeFaqs(faqsList),
      availability: normalizedAvailabilityList,
      availabilityConfig,
      status,
      isDeleted: false,
      deletedAt: null,
      country: country || undefined,
      zone: zone || undefined,
      departurePoint: departurePoint || undefined,
      durationDays: durationDays === "" ? undefined : Number(durationDays),
      activityType: activityType || undefined,
      difficulty: difficulty || undefined,
      guideType: guideType || undefined,
      transport: transport || undefined,
      groups: groups || undefined,
      story: parseMultilineList(storyText),
      tourPackages: preparedTourPackages,
      featured,
    };

    let updatedTours = [...allTours];
    setIsSavingTour(true);

    try {
      if (editingTourId) {
        try {
          const res = await fetch("/api/admin/tour", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: editingTourId,
              title,
              slug: slugifyTourValue(slug || title),
              description,
              price: payload.price,
              minPeople: payload.minPeople,
              images: orderedImageList,
              categoryId,
              status,
              country: payload.country,
              zone: payload.zone,
              departurePoint: payload.departurePoint,
              durationDays: payload.durationDays,
              activityType: payload.activityType,
              difficulty: payload.difficulty,
              guideType: payload.guideType,
              transport: payload.transport,
              groups: payload.groups,
              story: payload.story,
              tourPackages: payload.tourPackages,
              includedItems: payload.includedItems,
              recommendations: payload.recommendations,
              faqs: payload.faqs,
              featured: payload.featured,
              isDeleted: payload.isDeleted,
              deletedAt: payload.deletedAt,
              availability: payload.availability,
              availabilityConfig: payload.availabilityConfig,
            }),
          });

          if (res.status === 401) {
            setIsAuthenticated(false);
            setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
            return false;
          }

          if (!res.ok) {
            if (res.status === 413) {
              setFeedback({ type: "error", message: "Las imagenes del tour exceden el limite permitido. Reduce cantidad o tamano de imagenes." });
              return false;
            }
            setFeedback({ type: "error", message: "No se pudo actualizar el tour en la base de datos." });
            return false;
          }

          const savedTour = await res.json().catch(() => null);
          updatedTours = updatedTours.map((tour) => (tour.id === editingTourId ? { ...tour, ...payload, ...(savedTour || {}) } : tour));
        } catch {
          setFeedback({ type: "error", message: "Error de conexion al actualizar el tour en la base de datos." });
          return false;
        }
        setFeedback({ type: "success", message: "Tour actualizado correctamente." });
      } else {
        let createdId = nextId(updatedTours);
        let createdTour: Partial<TourAdminView> | null = null;
        try {
          const res = await fetch("/api/admin/tour", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              slug: slugifyTourValue(slug || title),
              description,
              price: payload.price,
              minPeople: payload.minPeople,
              images: orderedImageList,
              categoryId,
              status,
              country: payload.country,
              zone: payload.zone,
              departurePoint: payload.departurePoint,
              durationDays: payload.durationDays,
              activityType: payload.activityType,
              difficulty: payload.difficulty,
              guideType: payload.guideType,
              transport: payload.transport,
              groups: payload.groups,
              story: payload.story,
              tourPackages: payload.tourPackages,
              includedItems: payload.includedItems,
              recommendations: payload.recommendations,
              faqs: payload.faqs,
              featured: payload.featured,
              isDeleted: payload.isDeleted,
              deletedAt: payload.deletedAt,
              availability: payload.availability,
              availabilityConfig: payload.availabilityConfig,
            }),
          });
          if (res.status === 401) {
            setIsAuthenticated(false);
            setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
            return false;
          }

          if (res.ok) {
            const created = await res.json();
            if (created?.id) createdId = created.id;
            createdTour = created;
          } else {
            if (res.status === 413) {
              setFeedback({ type: "error", message: "Las imagenes del tour exceden el limite permitido. Reduce cantidad o tamano de imagenes." });
              return false;
            }
            setFeedback({ type: "error", message: "No se pudo crear el tour en la base de datos." });
            return false;
          }
        } catch {
          setFeedback({ type: "error", message: "Error de conexion al crear el tour en la base de datos." });
          return false;
        }

        const inferredCreatedAt =
          createdTour && typeof createdTour.createdAt === "string" && createdTour.createdAt.trim()
            ? createdTour.createdAt
            : new Date().toISOString();

        updatedTours = [{ id: createdId, createdAt: inferredCreatedAt, ...payload, ...(createdTour || {}) }, ...updatedTours];
        setFeedback({ type: "success", message: "Tour creado correctamente." });
      }

      const saved = saveToursLocal(updatedTours);
      if (!saved) return false;
      resetTourForm();
      setEditorInitial(null);
      if (isEditorRoute) {
        router.push("/admin");
      } else {
        setIsEditorOpen(false);
      }
      return true;
    } finally {
      setIsSavingTour(false);
    }
  };

  const handleEditTour = (tour: TourAdminView) => {
    const editorTourPackages = buildEditorTourPackages(
      (tour as { tourPackages?: unknown }).tourPackages,
      tour.priceOptions,
      tour.price,
    );

    setEditingTourId(tour.id);
    setTitle(tour.title);
    setSlug(tour.slug || slugifyTourValue(tour.title));
    setDescription(tour.description);
    setMinPeople(typeof tour.minPeople === "number" && tour.minPeople > 0 ? tour.minPeople : 1);
    setImageList(tour.images || []);
    setFeaturedImageUrl(tour.images?.[0] ?? null);
    setCategoryId(tour.category?.id ?? null);
    setCountry(tour.country || "");
    setZone(tour.zone || "");
    setDeparturePoint(tour.departurePoint || "");
    setDurationDays(typeof tour.durationDays === "number" ? tour.durationDays : "");
    setActivityType(tour.activityType || "");
    setDifficulty(tour.difficulty || "");
    setGuideType(tour.guideType || "");
    setTransport(tour.transport || "");
    setGroups(tour.groups || "");
    setStoryText(formatMultilineList(tour.story));
    setTourPackages(editorTourPackages);
    setOpenPackageIds(editorTourPackages.map((pkg) => pkg.id));
    setIncludedText(formatMultilineList(tour.includedItems));
    setRecommendationsText(formatMultilineList(tour.recommendations));
    setFaqsList(sanitizeFaqs(tour.faqs));
    const effectiveAvailability = getEffectiveAvailability(tour);
    const effectiveAvailabilityConfig = getEffectiveAvailabilityConfig(tour, effectiveAvailability);
    setAvailabilityList(applyDateSchedulesToAvailability(effectiveAvailability, effectiveAvailabilityConfig.dateSchedules));
    setAvailabilityMode(effectiveAvailabilityConfig.mode);
    setOpenSchedule(effectiveAvailabilityConfig.openSchedule);
    setFaqQuestionInput("");
    setFaqAnswerInput("");
    setAvailabilityDateInput("");
    setAvailabilityMaxPeopleInput(8);
    setAvailabilityUseCustomTimesInput(false);
    setAvailabilityCustomTimesInput("");
    setAvailabilityStartTimeInput("08:00");
    setAvailabilityEndTimeInput("17:00");
    setAvailabilityIntervalInput("");
    setOpenManualHourInput("08");
    setOpenManualMinuteInput("00");
    setSpecificManualHourInput("08");
    setSpecificManualMinuteInput("00");
    setStatus(tour.status ?? "BORRADOR");
    setFeatured(Boolean(tour.featured));
    const nextEditor: TourEditorState = {
      editingTourId: tour.id,
      title: tour.title,
      slug: tour.slug || slugifyTourValue(tour.title),
      description: tour.description,
      minPeople: typeof tour.minPeople === "number" && tour.minPeople > 0 ? tour.minPeople : 1,
      imageList: tour.images || [],
      categoryId: tour.category?.id ?? null,
      country: tour.country || "",
      zone: tour.zone || "",
      departurePoint: tour.departurePoint || "",
      durationDays: typeof tour.durationDays === "number" ? tour.durationDays : "",
      activityType: tour.activityType || "",
      difficulty: tour.difficulty || "",
      guideType: tour.guideType || "",
      transport: tour.transport || "",
      groups: tour.groups || "",
      storyText: formatMultilineList(tour.story),
      tourPackages: editorTourPackages,
      includedText: formatMultilineList(tour.includedItems),
      recommendationsText: formatMultilineList(tour.recommendations),
      faqsList: sanitizeFaqs(tour.faqs),
      availabilityList: applyDateSchedulesToAvailability(effectiveAvailability, effectiveAvailabilityConfig.dateSchedules),
      availabilityConfig: effectiveAvailabilityConfig,
      status: tour.status ?? "BORRADOR",
      featured: Boolean(tour.featured),
    };
    setEditorInitial(nextEditor);
    setInlineCategoryName("");
    setIsEditorOpen(true);
  };

  const showConfirmClose = (): Promise<boolean> =>
    new Promise((resolve) => {
      confirmCloseResolveRef.current = resolve;
      setConfirmCloseOpen(true);
    });

  const handleCloseEditor = async () => {
    if (editorHasChanges) {
      const abandon = await showConfirmClose();
      if (!abandon) return;
    }

    if (isEditorRoute) {
      setEditorInitial(null);
      resetTourForm();
      router.push("/admin");
      return;
    }

    setIsEditorOpen(false);
    setEditorInitial(null);
    resetTourForm();
  };

  const handleChangeTourStatus = async (tourId: number, nextStatus: TourStatus) => {
    try {
      const res = await fetch("/api/admin/tour", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tourId, status: nextStatus }),
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setFeedback({ type: "error", message: errorData?.error || "No se pudo actualizar el estado del tour." });
        return;
      }

      const nextTours = allTours.map((tour) => (tour.id === tourId ? { ...tour, status: nextStatus } : tour));
      const saved = saveToursLocal(nextTours);
      if (!saved) return;
      setFeedback({ type: "success", message: "Estado actualizado." });
    } catch {
      setFeedback({ type: "error", message: "Error de conexion al actualizar el estado del tour." });
    }
  };

  const handleDeleteTour = async (tourId: number) => {
    const confirmDelete = window.confirm("Este tour se movera a la papelera. Deseas continuar?");
    if (!confirmDelete) return;

    try {
      const deletedAt = new Date().toISOString();
      const res = await fetch("/api/admin/tour", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tourId,
          status: "NO_ACTIVO",
          isDeleted: true,
          deletedAt,
        }),
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setFeedback({ type: "error", message: errorData?.error || "No se pudo mover el tour a la papelera." });
        return;
      }

      await loadData();
      if (editingTourId === tourId) {
        resetTourForm();
        setIsEditorOpen(false);
        setEditorInitial(null);
      }
      setFeedback({ type: "success", message: "Tour enviado a papelera." });
    } catch {
      setFeedback({ type: "error", message: "Error de conexion al mover el tour a papelera." });
    }
  };

  const handleRestoreTour = async (tourId: number) => {
    const confirmRestore = window.confirm("Se reactivara este tour y volvera a estar visible. Deseas continuar?");
    if (!confirmRestore) return;

    try {
      const res = await fetch("/api/admin/tour", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tourId,
          status: "ACTIVO",
          isDeleted: false,
          deletedAt: null,
        }),
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setFeedback({ type: "error", message: errorData?.error || "No se pudo restaurar el tour." });
        return;
      }

      await loadData();
      setFeedback({ type: "success", message: "Tour reactivado correctamente." });
    } catch {
      setFeedback({ type: "error", message: "Error de conexion al restaurar el tour." });
    }
  };

  const handlePermanentDeleteTour = async (tourId: number) => {
    const confirmDelete = window.confirm("Esta accion eliminara el tour de forma permanente. Deseas continuar?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/tour?id=${tourId}`, { method: "DELETE" });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setFeedback({ type: "error", message: errorData?.error || "No se pudo eliminar el tour permanentemente." });
        return;
      }

      await loadData();
      if (editingTourId === tourId) {
        resetTourForm();
        setIsEditorOpen(false);
        setEditorInitial(null);
      }
      setFeedback({ type: "success", message: "Tour eliminado permanentemente." });
    } catch {
      setFeedback({ type: "error", message: "Error de conexion al eliminar el tour permanentemente." });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setFeedback({ type: "error", message: "El nombre de categoria es obligatorio." });
      return;
    }

    try {
      const res = await fetch("/api/admin/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setFeedback({ type: "error", message: errorData?.error || "No se pudo crear la categoria." });
        return;
      }

      const created = (await res.json()) as Category;
      const normalizedCreated = normalizeCategory(created as CategoryInput);
      if (!normalizedCreated) {
        setFeedback({ type: "error", message: "La API devolvio una categoria invalida." });
        return;
      }

      const nextCategories = [...categories, { ...normalizedCreated, description: newCategoryDescription.trim() }];
      const saved = saveCategoriesLocal(nextCategories);
      if (!saved) return;
      setNewCategoryName("");
      setNewCategoryDescription("");
      setCategoryId(normalizedCreated.id);
      setFeedback({ type: "success", message: "Categoria creada." });
    } catch {
      setFeedback({ type: "error", message: "Error de conexion al crear la categoria." });
    }
  };

  const handleAddCategoryInline = async () => {
    const normalizedName = inlineCategoryName.trim();
    if (!normalizedName) {
      setFeedback({ type: "error", message: "Ingresa un nombre de categoria." });
      return;
    }

    const existing = categories.find((category) => category.name.toLowerCase() === normalizedName.toLowerCase());
    if (existing) {
      setCategoryId(existing.id);
      setInlineCategoryName("");
      setFeedback({ type: "success", message: "Categoria existente seleccionada." });
      return;
    }

    try {
      const res = await fetch("/api/admin/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setFeedback({ type: "error", message: errorData?.error || "No se pudo crear la categoria." });
        return;
      }

      const created = (await res.json()) as Category;
      const normalizedCreated = normalizeCategory(created as CategoryInput);
      if (!normalizedCreated) {
        setFeedback({ type: "error", message: "La API devolvio una categoria invalida." });
        return;
      }

      const nextCategories = [...categories, normalizedCreated];
      const saved = saveCategoriesLocal(nextCategories);
      if (!saved) return;

      setCategoryId(normalizedCreated.id);
      setInlineCategoryName("");
      setFeedback({ type: "success", message: "Categoria creada y seleccionada." });
    } catch {
      setFeedback({ type: "error", message: "Error de conexion al crear la categoria." });
    }
  };

  const handleStartEditCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryDescription(category.description || "");
  };

  const handleSaveCategoryEdit = async () => {
    if (!editingCategoryId) return;
    if (isSavingCategoryEdit) return;
    if (!editingCategoryName.trim()) {
      setFeedback({ type: "error", message: "El nombre de categoria es obligatorio." });
      return;
    }

    const nextCategories = categories.map((category) =>
      category.id === editingCategoryId
        ? { ...category, name: editingCategoryName.trim(), description: editingCategoryDescription.trim() }
        : category,
    );

    const nextTours = allTours.map((tour) => {
      if (tour.category?.id !== editingCategoryId) return tour;
      return { ...tour, category: { id: editingCategoryId, name: editingCategoryName.trim() } };
    });

    setIsSavingCategoryEdit(true);
    try {
      try {
        const res = await fetch("/api/admin/category", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingCategoryId, name: editingCategoryName.trim() }),
        });

        if (res.status === 401) {
          setIsAuthenticated(false);
          setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
          return;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          setFeedback({ type: "error", message: errorData?.error || "No se pudo actualizar la categoria." });
          return;
        }

        const categoriesSaved = saveCategoriesLocal(nextCategories);
        const toursSaved = saveToursLocal(nextTours);
        if (!categoriesSaved || !toursSaved) return;
      } catch {
        setFeedback({ type: "error", message: "Error de conexion al actualizar la categoria." });
        return;
      }

      setEditingCategoryId(null);
      setEditingCategoryName("");
      setEditingCategoryDescription("");
      setFeedback({ type: "success", message: "Categoria actualizada." });
    } finally {
      setIsSavingCategoryEdit(false);
    }
  };

  const handleDeleteCategory = async (categoryIdToDelete: number) => {
    const usedByTours = allTours.some((tour) => tour.category?.id === categoryIdToDelete);
    if (usedByTours) {
      setFeedback({ type: "error", message: "No puedes eliminar una categoria usada por tours existentes." });
      return;
    }

    try {
      const res = await fetch(`/api/admin/category?id=${categoryIdToDelete}`, { method: "DELETE" });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setFeedback({ type: "error", message: errorData?.error || "No se pudo eliminar la categoria." });
        return;
      }

      const nextCategories = categories.filter((category) => category.id !== categoryIdToDelete);
      const saved = saveCategoriesLocal(nextCategories);
      if (!saved) return;

      if (categoryId === categoryIdToDelete) setCategoryId(nextCategories[0]?.id ?? null);
      setFeedback({ type: "success", message: "Categoria eliminada." });
    } catch {
      setFeedback({ type: "error", message: "Error de conexion al eliminar la categoria." });
    }
  };

  const handleSaveFilterConfig = async () => {
    if (isSavingFilterConfig) return;
    setIsSavingFilterConfig(true);
    try {
      localStorage.setItem(FILTER_CONFIG_KEY, JSON.stringify(filterConfig));
      await new Promise((resolve) => setTimeout(resolve, 500));
      setFeedback({ type: "success", message: "Configuracion de filtros guardada." });
    } finally {
      setIsSavingFilterConfig(false);
    }
  };

  const searchedTours = useMemo(() => {
    const query = searchTour.trim().toLowerCase();
    if (!query) return allTours;
    return allTours.filter((tour) =>
      `${tour.title} ${tour.country ?? ""} ${tour.zone ?? ""} ${tour.activityType ?? ""}`.toLowerCase().includes(query),
    );
  }, [allTours, searchTour]);

  const tabCounts = useMemo(
    () => ({
      ACTIVOS: allTours.filter((tour) => !tour.isDeleted && (tour.status ?? "BORRADOR") === "ACTIVO").length,
      BORRADOR: allTours.filter((tour) => !tour.isDeleted && (tour.status ?? "BORRADOR") === "BORRADOR").length,
      DESACTIVADOS: allTours.filter((tour) => !tour.isDeleted && (tour.status ?? "BORRADOR") === "NO_ACTIVO").length,
      PAPELERA: allTours.filter((tour) => tour.isDeleted).length,
    }),
    [allTours],
  );

  const tabTours = useMemo(() => {
    if (activeTab === "PAPELERA") return searchedTours.filter((tour) => tour.isDeleted);
    if (activeTab === "ACTIVOS") return searchedTours.filter((tour) => !tour.isDeleted && (tour.status ?? "BORRADOR") === "ACTIVO");
    if (activeTab === "BORRADOR") return searchedTours.filter((tour) => !tour.isDeleted && (tour.status ?? "BORRADOR") === "BORRADOR");
    return searchedTours.filter((tour) => !tour.isDeleted && (tour.status ?? "BORRADOR") === "NO_ACTIVO");
  }, [activeTab, searchedTours]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(tabTours.length / itemsPerPage)), [tabTours.length, itemsPerPage]);

  const requestedPage = pagination.scope === paginationScope ? pagination.page : 1;
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);

  const paginatedTours = (() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tabTours.slice(start, start + itemsPerPage);
  })();

  const isCurrentPageFullySelected = useMemo(() => {
    if (paginatedTours.length === 0) return false;
    return paginatedTours.every((tour) => effectiveSelectedTourIds.includes(tour.id));
  }, [effectiveSelectedTourIds, paginatedTours]);

  const syncEditorRoute = useEffectEvent(() => {
    if (!isEditorRoute || isAuthChecking || !isAuthenticated) return;

    const idParam = searchParams?.get("id") ?? null;
    if (idParam) {
      const targetId = Number(idParam);
      if (!Number.isFinite(targetId)) {
        router.push("/admin");
        return;
      }

      const tourToEdit = allTours.find((tour) => tour.id === targetId);
      if (tourToEdit) {
        if (!isEditorOpen || editingTourId !== targetId) {
          handleEditTour(tourToEdit);
        }
        return;
      }

      if (allTours.length > 0) {
        router.push("/admin");
      }
      return;
    }

    if (!isEditorOpen || editingTourId !== null) {
      openCreateTour();
    }
  });

  useEffect(() => {
    syncEditorRoute();
  }, [isEditorRoute, isAuthChecking, isAuthenticated, searchParams, allTours, isEditorOpen, editingTourId, categories]);

  if (isAuthChecking) {
    return (
      <section className="mx-auto max-w-md px-4 py-16">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-300/40">
          <p className="text-sm font-semibold text-slate-600">Verificando sesion de administrador...</p>
        </article>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-md px-4 py-16">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-300/40">
          <h1 className="text-2xl font-extrabold text-slate-900">Ingreso admin</h1>
          <p className="mt-2 text-sm text-slate-600">Accede para gestionar tours, categorias y filtros visibles.</p>

          <form className="mt-5 space-y-3" onSubmit={handleLogin}>
            <label className="block text-sm font-bold text-slate-700">
              Usuario
              <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Usuario" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Contrasena
              <input type="password" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Contrasena" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
            </label>
            <button type="submit" className="w-full rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-600">
              Entrar al panel
            </button>
          </form>

          <p className="mt-3 text-xs text-slate-500">Ingresa con tus credenciales de administrador configuradas en el servidor.</p>
          {loginError && <p className="mt-2 text-sm font-semibold text-rose-600">{loginError}</p>}
        </article>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 p-6 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Panel de administracion</h1>
          <p className="mt-1 text-sm text-emerald-100">
            {isEditorRoute
              ? "Editor de tours en pantalla completa para trabajar sin distracciones."
              : "Administra tours, categorias, filtros y recursos desde un solo lugar."}
          </p>
        </div>
        <button type="button" onClick={handleLogout} className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold hover:bg-white/30">
          Cerrar sesion
        </button>
      </div>

      {feedback && (
        <p className={`mb-5 rounded-xl p-3 text-sm font-semibold ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {feedback.message}
        </p>
      )}

      {!isEditorRoute && (
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Gestion de tours</h2>
            <p className="mt-1 text-sm text-slate-600">Lista compacta para administrar tus tours rapidamente.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                value={searchTour}
                onChange={(e) => setSearchTour(e.target.value)}
                placeholder="Buscar por nombre, pais o actividad"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-xl"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/admin/media")}
                  className="whitespace-nowrap rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 md:text-sm"
                >
                  Biblioteca de medios
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/admin/pedidos")}
                  className="whitespace-nowrap rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 md:text-sm"
                >
                  Pedidos / Reservas
                </button>
                <button type="button" onClick={() => openEditorRoute()} className="whitespace-nowrap rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 md:text-sm">
                  Nuevo tour
                </button>
              </div>
            </div>

            <input
              ref={importToursCsvRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleImportToursCsv(e.target.files)}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => importToursCsvRef.current?.click()} className="whitespace-nowrap rounded-lg border border-violet-300 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 md:text-sm">
                Importar CSV
              </button>
              <button type="button" onClick={() => handleExportToursCsv("all")} className="whitespace-nowrap rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 md:text-sm">
                Exportar todos CSV
              </button>
              <button type="button" onClick={() => handleExportToursCsv("selected")} className="whitespace-nowrap rounded-lg border border-teal-300 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 md:text-sm">
                Exportar seleccionados ({effectiveSelectedTourIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTourIds([])}
                disabled={effectiveSelectedTourIds.length === 0}
                className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                Limpiar seleccion
              </button>
              <button type="button" onClick={() => setIsFilterConfigOpen(true)} className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 md:text-sm">
                Filtros visibles
              </button>
              <button type="button" onClick={() => setIsCategoryManagerOpen(true)} className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 md:text-sm">
                Categorias
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVOS")}
            className={`rounded-xl border px-3 py-2 text-sm font-bold ${activeTab === "ACTIVOS" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
          >
            Activos ({tabCounts.ACTIVOS})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("BORRADOR")}
            className={`rounded-xl border px-3 py-2 text-sm font-bold ${activeTab === "BORRADOR" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}`}
          >
            Borrador ({tabCounts.BORRADOR})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DESACTIVADOS")}
            className={`rounded-xl border px-3 py-2 text-sm font-bold ${activeTab === "DESACTIVADOS" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"}`}
          >
            Desactivados ({tabCounts.DESACTIVADOS})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PAPELERA")}
            className={`rounded-xl border px-3 py-2 text-sm font-bold ${activeTab === "PAPELERA" ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-600"}`}
          >
            Papelera ({tabCounts.PAPELERA})
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Mostrando {tabTours.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, tabTours.length)} de {tabTours.length} tours
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-600">Tours por pagina</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isCurrentPageFullySelected}
                    onChange={(e) => handleToggleSelectPageTours(e.target.checked)}
                    aria-label="Seleccionar tours de la pagina"
                  />
                </th>
                <th className="px-3 py-3">Tour</th>
                <th className="px-3 py-3">Categoria</th>
                <th className="px-3 py-3">{activeTab === "PAPELERA" ? "Eliminado" : "Estado"}</th>
                <th className="px-3 py-3">Precio</th>
                <th className="px-3 py-3">Pais</th>
                <th className="px-3 py-3">Zona</th>
                <th className="px-3 py-3">Actividad</th>
                <th className="px-3 py-3">Creado</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedTours.map((tour) => (
                <tr key={tour.id}>
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={effectiveSelectedTourIds.includes(tour.id)}
                      onChange={() => handleToggleTourSelection(tour.id)}
                      aria-label={`Seleccionar tour ${tour.title}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      {tour.images?.[0] ? (
                        <img src={tour.images[0]} alt={tour.title} className="h-14 w-14 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Sin foto
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{tour.title}</p>
                        <p className="line-clamp-2 whitespace-pre-line text-xs text-slate-500">{tour.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{tour.category?.name ?? "Sin categoria"}</td>
                  <td className="px-3 py-3">
                    {activeTab === "PAPELERA" ? (
                      <span className="text-xs text-slate-600">{tour.deletedAt ? new Date(tour.deletedAt).toLocaleString() : "-"}</span>
                    ) : (
                      <select
                        value={tour.status ?? "BORRADOR"}
                        onChange={(e) => handleChangeTourStatus(tour.id, e.target.value as TourStatus)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700"
                      >
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="BORRADOR">BORRADOR</option>
                        <option value="NO_ACTIVO">NO ACTIVO</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3 font-semibold text-emerald-700">${tour.price.toFixed(2)}</td>
                  <td className="px-3 py-3 text-slate-700">{tour.country || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{tour.zone || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{tour.activityType || "-"}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{formatCreatedAtLabel(tour.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      {activeTab === "PAPELERA" ? (
                        <>
                          <button type="button" onClick={() => handleRestoreTour(tour.id)} className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-700">
                            Reactivar
                          </button>
                          <button type="button" onClick={() => handlePermanentDeleteTour(tour.id)} className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-bold text-rose-600">
                            Eliminar definitivo
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => openEditorRoute(tour.id)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700">
                            Editar
                          </button>
                          <button type="button" onClick={() => handleDeleteTour(tour.id)} className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-bold text-rose-600">
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedTours.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-5 text-center text-slate-500">
                    No hay tours para mostrar en esta pestana.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm font-semibold text-slate-600">
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </article>
      )}

      {isEditorRoute && !isEditorOpen && (
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">Cargando editor...</p>
        </article>
      )}

      {isEditorOpen && (
        <section className={`${isEditorRoute ? "" : "mt-6"} grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]`}>
          <article className="rounded-2xl bg-white p-7 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">{editingTourId ? `Editar tour #${editingTourId}` : "Crear tour"}</h2>
                <p className="text-sm text-slate-600">Estructura limpia: lo principal al centro y configuraciones al panel derecho.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleCloseEditor} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">
                  {isEditorRoute ? "Volver al listado" : "Cerrar editor"}
                </button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleCreateOrUpdateTour();
              }}
              className="space-y-7"
            >
              <section className="rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                <p className="mb-4 inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-800">Principal</p>
                <div className="grid gap-3">
                  <label className="block text-sm font-bold text-slate-700">
                    Titulo
                    <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Titulo" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Link del tour
                    <div className="mt-1 flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
                      <span className="border-r border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">/tours/</span>
                      <input
                        className="w-full px-3 py-2"
                        placeholder="titulo-del-tour"
                        value={slug}
                        onChange={(e) => setSlug(slugifyTourValue(e.target.value))}
                      />
                    </div>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {status === "BORRADOR"
                        ? "En borrador se actualiza automaticamente al cambiar el titulo. Tambien puedes editarlo manualmente."
                        : "Cuando el tour esta activo o no activo, este link solo cambia de forma manual."}
                    </span>
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Descripcion
                    <textarea className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Descripcion" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
                  </label>
                </div>
              </section>

              <details className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
                <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">Paquetes y tipos de precio</summary>
                <div className="mt-3 space-y-4">
                  <div className="rounded-xl bg-emerald-50/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-emerald-900">Paquetes de precio (opcional)</p>
                      <button
                        type="button"
                        onClick={handleAddTourPackage}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Crear paquete
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Si no agregas paquetes ni precios, el tour se guardara solo informativo (sin opcion de reserva).
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPackageOpenMode("multiple")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${packageOpenMode === "multiple" ? "bg-white text-emerald-700" : "bg-white/60 text-slate-700"}`}
                      >
                        Multiples abiertos
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackageOpenMode("single")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${packageOpenMode === "single" ? "bg-white text-emerald-700" : "bg-white/60 text-slate-700"}`}
                      >
                        Solo uno abierto
                      </button>
                      <button
                        type="button"
                        onClick={handleExpandAllPackages}
                        className="rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Expandir todos
                      </button>
                      <button
                        type="button"
                        onClick={handleCollapseAllPackages}
                        className="rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Contraer todos
                      </button>
                    </div>
                  </div>

                  <div className="space-y-5 px-4 pb-4">
                    {tourPackages.map((pkg, pkgIndex) => {
                      const isExpanded = effectiveOpenPackageIds.includes(pkg.id);

                      return (
                        <div key={pkg.id} className="overflow-hidden rounded-2xl border-2 border-emerald-200/70 bg-white shadow-sm shadow-emerald-100/50">
                          <button
                            type="button"
                            onClick={() => togglePackageExpanded(pkg.id)}
                            className="flex w-full items-center justify-between gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-white px-4 py-3.5 text-left"
                          >
                            <div>
                              <span className="inline-flex rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                                Paquete {pkgIndex + 1}
                              </span>
                              <p className="mt-1 text-base font-black text-slate-900">{pkg.title.trim() || `Paquete ${pkgIndex + 1}`}</p>
                              {!isExpanded && pkg.description.trim() && (
                                <p className="mt-0.5 text-sm text-slate-500">{pkg.description}</p>
                              )}
                            </div>
                            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                              {isExpanded ? "Ocultar" : "Mostrar"}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="space-y-3 px-4 py-4">
                              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                                <p className="text-sm font-extrabold text-slate-800">Configuracion del paquete</p>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTourPackage(pkg.id)}
                                  className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                >
                                  Quitar paquete
                                </button>
                              </div>

                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="text-xs font-semibold text-slate-600">
                                  Titulo del paquete
                                  <input
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
                                    value={pkg.title}
                                    onChange={(e) => handlePackageMetaChange(pkg.id, "title", e.target.value)}
                                    placeholder="Ej: Premium aventura"
                                  />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                  Descripcion (opcional)
                                  <input
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
                                    value={pkg.description}
                                    onChange={(e) => handlePackageMetaChange(pkg.id, "description", e.target.value)}
                                    placeholder="Descripcion corta del paquete"
                                  />
                                </label>
                              </div>

                              <div className="rounded-lg bg-white/80">
                                {pkg.priceOptions.map((option) => (
                                  <div key={`${pkg.id}-${option.id}`} className="grid gap-2 border-b border-slate-100 bg-transparent p-3 last:border-b-0 md:grid-cols-[1.25fr_160px_auto_auto_auto] md:items-center">
                                    <label className="text-xs font-semibold text-slate-600">
                                      Nombre
                                      <input
                                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
                                        value={option.name}
                                        onChange={(e) => handlePackagePriceOptionChange(pkg.id, option.id, "name", e.target.value)}
                                        placeholder="Nombre del precio"
                                      />
                                    </label>

                                    <label className="text-xs font-semibold text-slate-600">
                                      Precio
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        min={0}
                                        step="0.01"
                                        disabled={option.isFree}
                                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:bg-slate-100"
                                        value={option.price}
                                        onChange={(e) => handlePackagePriceOptionChange(pkg.id, option.id, "price", e.target.value)}
                                        placeholder="Ej: 80.5"
                                      />
                                    </label>

                                    <label className="flex items-center gap-2 rounded-lg bg-slate-100/80 px-3 py-2 text-xs font-semibold text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={option.isFree}
                                        onChange={(e) => handlePackageTogglePriceOptionFree(pkg.id, option.id, e.target.checked)}
                                      />
                                      Gratis
                                    </label>

                                    <label className="flex items-center gap-2 rounded-lg bg-emerald-100/60 px-3 py-2 text-xs font-semibold text-emerald-700">
                                      <input
                                        type="radio"
                                        name="base-price-option-global"
                                        checked={option.isBase}
                                        onChange={() => handlePackageSetPriceOptionAsBase(pkg.id, option.id)}
                                      />
                                      Principal
                                    </label>

                                    {option.id.startsWith("custom-") ? (
                                      <button
                                        type="button"
                                        onClick={() => handlePackageRemoveCustomPriceOption(pkg.id, option.id)}
                                        className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                      >
                                        Quitar
                                      </button>
                                    ) : (
                                      <span className="text-center text-[11px] font-semibold text-slate-400">Base</span>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => handlePackageAddCustomPriceOption(pkg.id)}
                                className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                Agregar tipo de precio al paquete
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>

              <details className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
                <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-700">Galeria</summary>
                <div className="mt-3 px-4 pb-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Imagenes del tour</p>
                  <p className="mt-1 text-xs text-slate-600">Arrastra imagenes aqui o usa el boton para seleccionarlas desde tu computadora.</p>

                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleUploadImages(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!isGalleryUploading) openGalleryPicker();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!isGalleryUploading) openGalleryPicker();
                      }
                    }}
                    onDragOver={handleGalleryDragOver}
                    onDragLeave={handleGalleryDragLeave}
                    onDrop={handleGalleryDrop}
                    className={`mt-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${isGalleryDragActive ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-slate-50/70 hover:border-emerald-300"} ${isGalleryUploading ? "cursor-not-allowed opacity-70" : ""}`}
                  >
                    <p className="text-sm font-semibold text-slate-700">
                      {isGalleryUploading ? "Subiendo imagenes..." : "Haz clic aqui para seleccionar imagenes"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Tambien puedes arrastrarlas y soltarlas en esta zona.</p>
                    {isGalleryUploading && <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100"><span className="block h-full w-full animate-pulse bg-emerald-500" /></div>}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={openGalleryPicker}
                      disabled={isGalleryUploading}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGalleryUploading ? "Subiendo..." : "Seleccionar imagenes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void openMediaPicker();
                      }}
                      className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                    >
                      Elegir desde biblioteca
                    </button>
                    <button
                      type="button"
                      onClick={clearAllImages}
                      disabled={imageList.length === 0 || isGalleryUploading}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Dejar sin imagenes
                    </button>
                    <span className="text-xs text-slate-500">{imageList.length} imagen(es) cargada(s)</span>
                  </div>

                  {isMediaPickerOpen && (
                    <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-bold text-cyan-900">Biblioteca de medios (imagenes activas)</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void loadMediaLibraryItems();
                            }}
                            disabled={isMediaPickerLoading}
                            className="rounded-lg border border-cyan-300 bg-white px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isMediaPickerLoading ? "Cargando..." : "Recargar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMediaPickerOpen(false);
                              setSelectedMediaUrls([]);
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={mediaPickerSearch}
                        onChange={(e) => setMediaPickerSearch(e.target.value)}
                        placeholder="Buscar imagen por nombre"
                        className="mt-2 w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm"
                      />

                      <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-cyan-100 bg-white p-2">
                        {isMediaPickerLoading ? (
                          <p className="p-2 text-sm font-semibold text-slate-600">Cargando imagenes...</p>
                        ) : mediaPickerVisibleItems.length === 0 ? (
                          <p className="p-2 text-sm text-slate-500">No hay imagenes activas en la biblioteca.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            {mediaPickerVisibleItems.map((item) => {
                              const checked = selectedMediaUrls.includes(item.url);
                              return (
                                <label key={item.id} className={`overflow-hidden rounded-lg border ${checked ? "border-cyan-500 ring-2 ring-cyan-200" : "border-slate-200"}`}>
                                  <div className="relative">
                                    <img src={item.url} alt={item.name} className="aspect-square w-full object-cover" />
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => toggleMediaSelection(item.url, e.target.checked)}
                                      className="absolute right-1 top-1 h-4 w-4"
                                    />
                                  </div>
                                  <p className="truncate px-2 py-1 text-[11px] font-semibold text-slate-700" title={item.name}>{item.name}</p>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-600">{selectedMediaUrls.length} seleccionada(s)</p>
                        <button
                          type="button"
                          onClick={addSelectedMediaToTour}
                          disabled={selectedMediaUrls.length === 0}
                          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Agregar seleccionadas al tour
                        </button>
                      </div>
                    </div>
                  )}

                  {imageList.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      {imageList.map((image, index) => (
                        <div key={`${image.slice(0, 20)}-${index}`} className="relative overflow-hidden rounded-lg bg-white ring-1 ring-slate-200/70">
                          <img src={image} alt={`preview-${index}`} className="aspect-square w-full object-cover" />
                          <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            <input
                              type="radio"
                              name="featured-image"
                              checked={featuredImageUrl === image}
                              onChange={() => setFeaturedImageUrl(image)}
                            />
                            Destacada
                          </div>
                          <button type="button" onClick={() => removeImage(index)} className="absolute right-1 top-1 rounded bg-white/90 px-1 text-xs font-bold text-rose-600">
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {imageList.length === 0 && (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Este tour se guardara sin imagenes. Puedes agregar una despues si lo deseas.
                    </p>
                  )}
                </div>
              </details>

              <details className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
                <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">Contenido del tour</summary>
                <div className="mt-3 grid gap-3 px-4 pb-4">
                <label className="text-sm font-bold text-slate-700">
                  Lo que esta incluido
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    rows={3}
                    placeholder="Un item por linea"
                    value={includedText}
                    onChange={(e) => setIncludedText(e.target.value)}
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Recomendaciones
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    rows={3}
                    placeholder="Una recomendacion por linea"
                    value={recommendationsText}
                    onChange={(e) => setRecommendationsText(e.target.value)}
                  />
                </label>
                </div>
              </details>

              <details className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
                <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">Preguntas frecuentes</summary>
                <div className="mt-3 px-4 pb-4">
                <label className="text-sm font-bold text-slate-700">
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={handleDownloadFaqCsv} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
                      Descargar CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => faqCsvInputRef.current?.click()}
                      className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      Subir CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFaqBulkOpen(true)}
                      className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      Subir masivamente
                    </button>
                    <input
                      ref={faqCsvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={async (e) => {
                        await handleImportFaqCsv(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>

                  <div className="mt-1 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <label className="block text-sm font-bold text-slate-700">
                      Pregunta
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                        placeholder="Pregunta"
                        value={faqQuestionInput}
                        onChange={(e) => setFaqQuestionInput(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-bold text-slate-700">
                      Respuesta
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                        placeholder="Respuesta"
                        value={faqAnswerInput}
                        onChange={(e) => setFaqAnswerInput(e.target.value)}
                      />
                    </label>
                    <button type="button" onClick={handleAddFaq} className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                      Agregar
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {faqsList.map((faq, index) => (
                      <div key={`${faq.question}-${index}`} className="flex items-start justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{faq.question}</p>
                          <p className="text-sm text-slate-600">{faq.answer}</p>
                        </div>
                        <button type="button" onClick={() => handleRemoveFaq(index)} className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-bold text-rose-600">
                          Quitar
                        </button>
                      </div>
                    ))}
                    {faqsList.length === 0 && <p className="text-xs text-slate-500">Aun no has agregado preguntas frecuentes.</p>}
                  </div>

                  {isFaqBulkOpen && (
                    <div className="mt-3 rounded-xl bg-slate-100/80 p-3 ring-1 ring-slate-200/70">
                      <p className="mb-2 text-xs font-semibold text-slate-600">Formato por linea: Pregunta | Respuesta</p>
                      <textarea
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        rows={7}
                        placeholder={"Pregunta | Respuesta\nPregunta | Respuesta\nPregunta | Respuesta"}
                        value={faqBulkText}
                        onChange={(e) => setFaqBulkText(e.target.value)}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsFaqBulkOpen(false);
                            setFaqBulkText("");
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button type="button" onClick={handleApplyFaqBulkInput} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
                          Cargar masivamente
                        </button>
                      </div>
                    </div>
                  )}
                </label>
                </div>
              </details>

              <details className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
                <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">Fechas disponibles</summary>
                <div className="mt-3 px-4 pb-4">
                <p className="text-sm font-bold text-slate-700">Fechas disponibles</p>
                <p className="text-xs text-slate-500">Puedes activar modo abierto para permitir cualquier dia o definir fechas especificas con horarios opcionales.</p>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAvailabilityMode("SPECIFIC")}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                      availabilityMode === "SPECIFIC"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Dias especificos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityMode("OPEN")}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                      availabilityMode === "OPEN"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Abierto (todos los dias)
                  </button>
                </div>

                {availabilityMode === "OPEN" && (
                  <div className="mt-3 rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-200/70">
                    <p className="text-sm font-bold text-emerald-900">Horario del modo abierto</p>

                    <div className="mt-2 grid gap-2 md:grid-cols-4">
                      <label className="block text-xs font-bold text-slate-700">
                        Cupo por tour
                        <input
                          type="number"
                          min={1}
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                          value={openSchedule.maxPeople}
                          onChange={(e) =>
                            setOpenSchedule((prev) => ({
                              ...prev,
                              maxPeople: e.target.value === "" ? 1 : Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                        />
                      </label>
                      <label className="block text-xs font-bold text-slate-700">
                        Desde
                        <input
                          type="time"
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                          value={openSchedule.startTime}
                          onChange={(e) => setOpenSchedule((prev) => ({ ...prev, startTime: e.target.value }))}
                        />
                      </label>
                      <label className="block text-xs font-bold text-slate-700">
                        Hasta
                        <input
                          type="time"
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                          value={openSchedule.endTime}
                          onChange={(e) => setOpenSchedule((prev) => ({ ...prev, endTime: e.target.value }))}
                        />
                      </label>
                      <label className="block text-xs font-bold text-slate-700">
                        Cada
                        <select
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                          value={openSchedule.intervalMinutes}
                          onChange={(e) => setOpenSchedule((prev) => ({ ...prev, intervalMinutes: Number(e.target.value) || 30 }))}
                        >
                          {intervalMinuteOptions.map((value) => (
                            <option key={value} value={value}>{formatIntervalOptionLabel(value)}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={openSchedule.useCustomTimes}
                        onChange={(e) => setOpenSchedule((prev) => ({ ...prev, useCustomTimes: e.target.checked }))}
                      />
                      Definir horarios manualmente
                    </label>

                    {openSchedule.useCustomTimes && (
                      <div className="mt-2 rounded-xl bg-white p-3 ring-1 ring-slate-200/70">
                        <p className="text-xs font-bold text-slate-700">Horarios manuales</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                          <label className="text-xs font-bold text-slate-700">
                            Hora
                            <select
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                              value={openManualHourInput}
                              onChange={(e) => setOpenManualHourInput(e.target.value)}
                            >
                              {hourOptions.map((hour) => (
                                <option key={hour} value={hour}>{hour}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs font-bold text-slate-700">
                            Minutos
                            <select
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                              value={openManualMinuteInput}
                              onChange={(e) => setOpenManualMinuteInput(e.target.value)}
                            >
                              {minuteOptions.map((minute) => (
                                <option key={minute} value={minute}>{minute}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={handleAddOpenManualTime}
                            className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                          >
                            Agregar hora
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {parseCustomTimeSlots(openSchedule.customTimesText).map((slot) => (
                            <span key={slot} className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                              {formatTimeLabel(slot)}
                              <button type="button" onClick={() => handleRemoveOpenManualTime(slot)} className="font-extrabold text-emerald-900">
                                x
                              </button>
                            </span>
                          ))}
                          {parseCustomTimeSlots(openSchedule.customTimesText).length === 0 && (
                            <p className="text-xs text-slate-500">No hay horarios manuales definidos.</p>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="mt-2 text-xs text-slate-600">
                      Horarios activos: {previewOpenSlots.length ? previewOpenSlots.map((slot) => formatTimeLabel(slot)).join(", ") : "Sin horarios"}
                    </p>
                  </div>
                )}

                {availabilityMode === "SPECIFIC" && (
                  <>
                    <div className="mt-2 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
                      <p className="text-xs font-bold text-slate-700">Paso 1: Define horarios para la fecha</p>
                      <p className="text-xs text-slate-500">Primero configura los horarios y despues agrega la fecha.</p>

                      <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={availabilityUseCustomTimesInput}
                          onChange={(e) => setAvailabilityUseCustomTimesInput(e.target.checked)}
                        />
                        Ingresar horarios manualmente
                      </label>

                      {availabilityUseCustomTimesInput ? (
                        <div className="mt-2 rounded-xl bg-white p-3 ring-1 ring-slate-200/70">
                          <p className="text-xs font-bold text-slate-700">Horarios manuales</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                            <label className="text-xs font-bold text-slate-700">
                              Hora
                              <select
                                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                                value={specificManualHourInput}
                                onChange={(e) => setSpecificManualHourInput(e.target.value)}
                              >
                                {hourOptions.map((hour) => (
                                  <option key={hour} value={hour}>{hour}</option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs font-bold text-slate-700">
                              Minutos
                              <select
                                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                                value={specificManualMinuteInput}
                                onChange={(e) => setSpecificManualMinuteInput(e.target.value)}
                              >
                                {minuteOptions.map((minute) => (
                                  <option key={minute} value={minute}>{minute}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              onClick={handleAddSpecificManualTime}
                              className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                            >
                              Agregar hora
                            </button>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {parseCustomTimeSlots(availabilityCustomTimesInput).map((slot) => (
                              <span key={slot} className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                {formatTimeLabel(slot)}
                                <button type="button" onClick={() => handleRemoveSpecificManualTime(slot)} className="font-extrabold text-emerald-900">
                                  x
                                </button>
                              </span>
                            ))}
                            {parseCustomTimeSlots(availabilityCustomTimesInput).length === 0 && (
                              <p className="text-xs text-slate-500">No hay horarios manuales definidos.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          <label className="block text-xs font-bold text-slate-700">
                            Desde
                            <input
                              type="time"
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                              value={availabilityStartTimeInput}
                              onChange={(e) => setAvailabilityStartTimeInput(e.target.value)}
                            />
                          </label>
                          <label className="block text-xs font-bold text-slate-700">
                            Hasta
                            <input
                              type="time"
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                              value={availabilityEndTimeInput}
                              onChange={(e) => setAvailabilityEndTimeInput(e.target.value)}
                            />
                          </label>
                          <label className="block text-xs font-bold text-slate-700">
                            Cada
                            <select
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                              value={availabilityIntervalInput}
                              onChange={(e) => setAvailabilityIntervalInput(e.target.value === "" ? "" : Number(e.target.value))}
                            >
                              <option value="">Selecciona intervalo</option>
                              {intervalMinuteOptions.map((value) => (
                                <option key={value} value={value}>{formatIntervalOptionLabel(value)}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}

                      <p className="mt-2 text-xs text-slate-600">
                        Vista previa: {previewSpecificSlots.length ? previewSpecificSlots.map((slot) => formatTimeLabel(slot)).join(", ") : "Sin horarios"}
                      </p>
                    </div>

                    <div className="mt-2 grid gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 md:grid-cols-[1fr_160px_auto]">
                      <p className="md:col-span-3 text-xs font-bold text-emerald-900">Paso 2: Agrega fecha usando esos horarios</p>
                      <label className="block text-sm font-bold text-slate-700">
                        Fecha
                        <input
                          type="date"
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                          value={availabilityDateInput}
                          onChange={(e) => setAvailabilityDateInput(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-bold text-slate-700">
                        Cupo por tour
                        <input
                          type="number"
                          min={1}
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                          value={availabilityMaxPeopleInput}
                          onChange={(e) => setAvailabilityMaxPeopleInput(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="Cupo por tour"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleAddAvailability}
                        disabled={!hasSpecificScheduleConfigured || !availabilityDateInput}
                        className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent"
                      >
                        Agregar fecha
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {availabilityList
                        .slice()
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((item) => (
                          <div key={`${item.id}-${item.date}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                            <div>
                              <p className="text-sm text-slate-700">
                                {new Date(item.date).toLocaleDateString("es-ES")} | Cupo: {item.maxPeople}
                              </p>
                              <p className="text-xs text-slate-500">
                                Horarios: {normalizeTimeSlots(item.timeSlots).length ? normalizeTimeSlots(item.timeSlots).map((slot) => formatTimeLabel(slot)).join(", ") : "Sin horario fijo"}
                              </p>
                            </div>
                            <button type="button" onClick={() => handleRemoveAvailability(item.id)} className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-bold text-rose-600">
                              Quitar
                            </button>
                          </div>
                        ))}
                      {availabilityList.length === 0 && <p className="text-xs text-slate-500">No hay fechas configuradas.</p>}
                    </div>
                  </>
                )}
                </div>
              </details>

              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={handleCloseEditor} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingTour}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-400"
                >
                  {isSavingTour ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
              {isSavingTour && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100" aria-hidden="true">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500" />
                </div>
              )}
            </form>
          </article>

          <aside className="h-fit space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 lg:sticky lg:top-6">
            <section className="rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <p className="mb-4 inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-800">Publicacion</p>
              <label className="block text-sm font-bold text-slate-700">
                Estado
                <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as TourStatus)}>
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="NO_ACTIVO">NO ACTIVO</option>
                  <option value="BORRADOR">BORRADOR</option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold text-slate-700">
                Minimo de personas
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Minimo de personas"
                  value={minPeople}
                  onChange={(e) => setMinPeople(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </label>
              <label className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/70">
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                Marcar como destacado
              </label>
              <button
                type="button"
                onClick={async () => {
                  await handleCreateOrUpdateTour();
                }}
                disabled={isSavingTour}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {isSavingTour ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
              {isSavingTour && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100" aria-hidden="true">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500" />
                </div>
              )}
            </section>

            <section className="rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <p className="mb-4 inline-flex rounded-md bg-sky-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-800">Categoria</p>
              <label className="block text-sm font-bold text-slate-700">
                Categoria
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={categoryId ?? ""}
                  onChange={(e) => setCategoryId(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">Sin categoria</option>
                  {validCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold text-slate-700">Crear categoria rapida</label>
              <div className="mt-1 flex gap-2">
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Crear categoria rapida"
                  value={inlineCategoryName}
                  onChange={(e) => setInlineCategoryName(e.target.value)}
                />
                <button type="button" onClick={handleAddCategoryInline} className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                  Crear
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryManagerOpen(true)}
                className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white"
              >
                Gestionar categorias
              </button>
            </section>

            <section className="rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <p className="mb-4 inline-flex rounded-md bg-amber-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-800">Detalles adicionales</p>
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">
                  Pais
                  <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Pais (opcional)" value={country} onChange={(e) => setCountry(e.target.value)} />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Zona
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="Zona (opcional, puede existir sin pais)"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Punto de salida
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="Punto de salida exacto o punto de encuentro"
                    value={departurePoint}
                    onChange={(e) => setDeparturePoint(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Tipo de actividad
                  <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Tipo de actividad" value={activityType} onChange={(e) => setActivityType(e.target.value)} />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Duracion en dias
                  <input type="number" min={0} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Duracion en dias" value={durationDays} onChange={(e) => setDurationDays(e.target.value === "" ? "" : Number(e.target.value))} />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Dificultad
                  <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Dificultad" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Tipo de guia
                  <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Tipo de guia" value={guideType} onChange={(e) => setGuideType(e.target.value)} />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Transporte
                  <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Transporte" value={transport} onChange={(e) => setTransport(e.target.value)} />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Tamano de grupo
                  <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Tamano de grupo" value={groups} onChange={(e) => setGroups(e.target.value)} />
                </label>
              </div>
            </section>
          </aside>
        </section>
      )}

      {isFilterConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <article className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Configurar filtros visibles</h2>
              <button type="button" onClick={() => setIsFilterConfigOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-xl font-bold leading-none text-slate-700">
                X
              </button>
            </div>
            <div className="grid gap-2 text-sm text-slate-700">
              {Object.entries(filterConfig).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span>{filterConfigLabels[key as keyof FilterConfig]}</span>
                  <input type="checkbox" checked={value} onChange={(e) => setFilterConfig((prev) => ({ ...prev, [key]: e.target.checked }))} />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsFilterConfigOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">
                Cerrar
              </button>
              <button
                type="button"
                disabled={isSavingFilterConfig}
                onClick={async () => {
                  await handleSaveFilterConfig();
                  setIsFilterConfigOpen(false);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-500"
              >
                {isSavingFilterConfig ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
            {isSavingFilterConfig && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100" aria-hidden="true">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500" />
              </div>
            )}
          </article>
        </div>
      )}

      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <article className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Categorias</h2>
                <p className="text-sm text-slate-500">Seccion compacta para gestionar categorias.</p>
              </div>
              <button type="button" onClick={() => setIsCategoryManagerOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-xl font-bold leading-none text-slate-700">
                X
              </button>
            </div>

            <div className="flex w-full gap-2">
              <label className="w-full text-sm font-bold text-slate-700">
                Nueva categoria
                <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Nueva categoria" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
              </label>
              <button type="button" onClick={handleAddCategory} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-600">
                Agregar
              </button>
            </div>

            <div className="mt-4 max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              {categories.map((category) => (
                <div key={category.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  {editingCategoryId === category.id ? (
                    <div className="space-y-2">
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        placeholder="Nombre de categoria"
                      />
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={editingCategoryDescription}
                        onChange={(e) => setEditingCategoryDescription(e.target.value)}
                        placeholder="Descripcion (opcional)"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(null);
                            setEditingCategoryName("");
                            setEditingCategoryDescription("");
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveCategoryEdit}
                          disabled={isSavingCategoryEdit}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-500"
                        >
                          {isSavingCategoryEdit ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                              Guardando...
                            </>
                          ) : (
                            "Guardar"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{category.name}</p>
                        {category.description && <p className="text-xs text-slate-500">{category.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(category)}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-bold text-rose-600"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {categories.length === 0 && <p className="text-sm text-slate-500">No hay categorias registradas.</p>}
            </div>
          </article>
        </div>
      )}

      {confirmCloseOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { confirmCloseResolveRef.current?.(false); setConfirmCloseOpen(false); }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-base font-bold text-slate-800">¿Abandonar la edicion?</p>
            <p className="mb-6 text-sm text-slate-500">Tienes cambios sin guardar. Si abandonas se perderan.</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => { confirmCloseResolveRef.current?.(false); setConfirmCloseOpen(false); }}
              >
                Seguir editando
              </button>
              <button
                type="button"
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                onClick={() => { confirmCloseResolveRef.current?.(true); setConfirmCloseOpen(false); }}
              >
                Abandonar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-md px-4 py-16">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-300/40">
            <p className="text-sm font-semibold text-slate-600">Cargando panel de administracion...</p>
          </article>
        </section>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
