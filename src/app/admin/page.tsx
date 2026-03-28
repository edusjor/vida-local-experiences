"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TourStatus = "ACTIVO" | "NO_ACTIVO" | "BORRADOR";
type TourTab = "ACTIVOS" | "BORRADOR" | "DESACTIVADOS" | "PAPELERA";

interface TourEditorState {
  editingTourId: number | null;
  title: string;
  description: string;
  minPeople: number;
  imageList: string[];
  categoryId: number | null;
  country: string;
  zone: string;
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
}

interface PriceOptionEditor {
  id: string;
  name: string;
  price: number | "";
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
  featured?: boolean;
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

function slugifyPriceLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
      const parsedPrice = Number(source?.price);
      const normalizedPrice: number | "" = isFree ? 0 : Number.isFinite(parsedPrice) ? parsedPrice : "";

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

function parseEditorPriceInput(value: string): number | "" {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function normalizeUnfreePrice(value: number | ""): number | "" {
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

function ensureSingleBaseOption(items: PriceOptionEditor[]): PriceOptionEditor[] {
  if (!items.length) return items;
  const firstBaseIndex = items.findIndex((item) => item.isBase);
  const normalizedBaseIndex = firstBaseIndex === -1 ? 0 : firstBaseIndex;
  return items.map((item, index) => ({ ...item, isBase: index === normalizedBaseIndex }));
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
      const options = ensureSingleBaseOption(buildEditorPriceOptions(source?.priceOptions));

      return {
        id,
        title,
        description,
        priceOptions: options,
      };
    })
    .filter((pkg) => pkg.title.length > 0 || pkg.priceOptions.some((option) => option.name.length > 0))
    : [];

  if (normalizedFromPackages.length > 0) return normalizedFromPackages;

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
      price: item.isFree ? 0 : Number(item.price),
    }))
    .filter((item) => item.id && item.name && (item.isFree || (Number.isFinite(item.price) && item.price > 0)));

  const firstBaseIndex = preparedRaw.findIndex((item) => item.isBase);
  const normalizedBaseIndex = firstBaseIndex === -1 && preparedRaw.length > 0 ? 0 : firstBaseIndex;
  return preparedRaw.map((item, index) => ({
    ...item,
    isBase: normalizedBaseIndex !== -1 && index === normalizedBaseIndex,
  }));
}

function getPrimaryPriceFromPackages(
  items: Array<{ priceOptions: Array<{ price: number; isFree: boolean; isBase: boolean }> }>,
  fallbackPrice = 0,
): number {
  const firstPackage = items[0];
  if (!firstPackage || !firstPackage.priceOptions.length) return fallbackPrice;
  const baseOption = firstPackage.priceOptions.find((option) => option.isBase) || firstPackage.priceOptions[0];
  if (!baseOption) return fallbackPrice;
  return baseOption.isFree ? 0 : baseOption.price;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await toDataUrl(file);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 1200;
      const scale = image.width > maxWidth ? maxWidth / image.width : 1;
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
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
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseFaqsCsv(text: string): FaqItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const firstLower = lines[0].toLowerCase();
  const dataLines = firstLower.includes("pregunta") && firstLower.includes("respuesta") ? lines.slice(1) : lines;

  const parsed = dataLines.map((line) => {
    const row = parseCsvRow(line);
    const question = (row[0] ?? "").trim();
    const answer = (row[1] ?? "").trim();
    return { question, answer };
  });

  return sanitizeFaqs(parsed);
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

const defaultIncludedItems = [
  "Guia profesional",
  "Soporte de reservas",
  "Asistencia local",
  "Confirmacion inmediata",
];

const defaultRecommendations = ["Ropa comoda", "Protector solar", "Agua", "Documento personal"];

const defaultFaqItems: FaqItem[] = [
  { question: "Como reservo?", answer: "Haz clic en Reservar ahora y completa tus datos en menos de un minuto." },
  { question: "Se puede reprogramar?", answer: "Si, sujeto a disponibilidad y politica de cada operador." },
  { question: "Que pasa si llueve?", answer: "Te contactamos con alternativas disponibles para ese dia." },
];

const defaultAvailabilityItems: AvailabilityItem[] = [
  { id: 5001, date: "2026-03-20T09:00:00.000Z", maxPeople: 10 },
  { id: 5002, date: "2026-03-21T09:00:00.000Z", maxPeople: 8 },
  { id: 5003, date: "2026-03-24T09:00:00.000Z", maxPeople: 12 },
  { id: 5004, date: "2026-03-27T09:00:00.000Z", maxPeople: 8 },
];

function getEffectiveIncludedItems(tour: TourAdminView): string[] {
  return Array.isArray(tour.includedItems) && tour.includedItems.length ? tour.includedItems : defaultIncludedItems;
}

function getEffectiveRecommendations(tour: TourAdminView): string[] {
  return Array.isArray(tour.recommendations) && tour.recommendations.length ? tour.recommendations : defaultRecommendations;
}

function getEffectiveFaqs(tour: TourAdminView): FaqItem[] {
  return Array.isArray(tour.faqs) && tour.faqs.length ? tour.faqs : defaultFaqItems;
}

function getEffectiveAvailability(tour: TourAdminView): AvailabilityItem[] {
  return Array.isArray(tour.availability) && tour.availability.length ? tour.availability : defaultAvailabilityItems;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterConfigOpen, setIsFilterConfigOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<TourEditorState | null>(null);

  const [editingTourId, setEditingTourId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minPeople, setMinPeople] = useState<number | "">(1);
  const [imageList, setImageList] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [country, setCountry] = useState("");
  const [zone, setZone] = useState("");
  const [durationDays, setDurationDays] = useState<number | "">("");
  const [activityType, setActivityType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [guideType, setGuideType] = useState("");
  const [transport, setTransport] = useState("");
  const [groups, setGroups] = useState("");
  const [storyText, setStoryText] = useState("");
  const [tourPackages, setTourPackages] = useState<TourPackageEditor[]>([createEmptyTourPackage("Paquete principal")]);
  const [packageOpenMode, setPackageOpenMode] = useState<"multiple" | "single">("multiple");
  const [openPackageIds, setOpenPackageIds] = useState<string[]>([]);
  const [includedText, setIncludedText] = useState("");
  const [recommendationsText, setRecommendationsText] = useState("");
  const [faqsList, setFaqsList] = useState<FaqItem[]>([]);
  const [faqQuestionInput, setFaqQuestionInput] = useState("");
  const [faqAnswerInput, setFaqAnswerInput] = useState("");
  const [availabilityList, setAvailabilityList] = useState<AvailabilityItem[]>([]);
  const [availabilityDateInput, setAvailabilityDateInput] = useState("");
  const [availabilityMaxPeopleInput, setAvailabilityMaxPeopleInput] = useState<number | "">(10);
  const [isFaqBulkOpen, setIsFaqBulkOpen] = useState(false);
  const [faqBulkText, setFaqBulkText] = useState("");
  const faqCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<TourStatus>("BORRADOR");
  const [featured, setFeatured] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [inlineCategoryName, setInlineCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryDescription, setEditingCategoryDescription] = useState("");

  const [filterConfig, setFilterConfig] = useState<FilterConfig>(defaultFilterConfig);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const createEmptyEditorState = (defaultCategoryId: number | null): TourEditorState => ({
    editingTourId: null,
    title: "",
    description: "",
    minPeople: 1,
    imageList: [],
    categoryId: defaultCategoryId,
    country: "",
    zone: "",
    durationDays: "",
    activityType: "",
    difficulty: "",
    guideType: "",
    transport: "",
    groups: "",
    storyText: "",
    tourPackages: [createEmptyTourPackage("Paquete principal")],
    includedText: "",
    recommendationsText: "",
    faqsList: [],
    availabilityList: defaultAvailabilityItems,
    status: "BORRADOR",
    featured: false,
  });

  const applyEditorState = (state: TourEditorState) => {
    setEditingTourId(state.editingTourId);
    setTitle(state.title);
    setDescription(state.description);
    setMinPeople(state.minPeople);
    setImageList(state.imageList);
    setCategoryId(state.categoryId);
    setCountry(state.country);
    setZone(state.zone);
    setDurationDays(state.durationDays);
    setActivityType(state.activityType);
    setDifficulty(state.difficulty);
    setGuideType(state.guideType);
    setTransport(state.transport);
    setGroups(state.groups);
    setStoryText(state.storyText);
    setTourPackages(state.tourPackages);
    setOpenPackageIds(state.tourPackages.map((pkg) => pkg.id));
    setIncludedText(state.includedText);
    setRecommendationsText(state.recommendationsText);
    setFaqsList(state.faqsList);
    setAvailabilityList(state.availabilityList);
    setFaqQuestionInput("");
    setFaqAnswerInput("");
    setAvailabilityDateInput("");
    setAvailabilityMaxPeopleInput(10);
    setStatus(state.status);
    setFeatured(state.featured);
  };

  const currentEditorState: TourEditorState = {
    editingTourId,
    title,
    description,
    minPeople: minPeople === "" ? 1 : minPeople,
    imageList,
    categoryId,
    country,
    zone,
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
    status,
    featured,
  };

  const editorHasChanges = Boolean(
    isEditorOpen && editorInitial && JSON.stringify(currentEditorState) !== JSON.stringify(editorInitial),
  );

  useEffect(() => {
    setOpenPackageIds((prev) => {
      const validIds = prev.filter((id) => tourPackages.some((pkg) => pkg.id === id));
      if (!tourPackages.length) return [];
      if (!validIds.length) return [tourPackages[0].id];
      if (packageOpenMode === "single" && validIds.length > 1) return [validIds[0]];
      return validIds;
    });
  }, [tourPackages, packageOpenMode]);

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
    const config = safeParse<FilterConfig>(localStorage.getItem(FILTER_CONFIG_KEY), defaultFilterConfig);
    setFilterConfig({ ...defaultFilterConfig, ...config });

    fetch("/api/admin/auth")
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsAuthChecking(false));
  }, []);

  const loadData = () => {
    const localCategoriesRaw = safeParse<CategoryInput[]>(localStorage.getItem(LOCAL_CATEGORIES_KEY), []);
    const localCategories = localCategoriesRaw
      .map((category) => normalizeCategory(category))
      .filter((category): category is Category => category !== null);
    const localTours = safeParse<TourAdminView[]>(localStorage.getItem(LOCAL_TOURS_KEY), []);

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

        const remoteTours: TourAdminView[] = Array.isArray(apiTours)
          ? apiTours.map((tour: TourAdminView) => ({
              ...tour,
              status: tour.status ?? "BORRADOR",
              isDeleted: Boolean(tour.isDeleted),
              deletedAt: tour.deletedAt ?? null,
              country: tour.country ?? "",
              zone: tour.zone ?? "",
              activityType: tour.activityType ?? "",
              difficulty: tour.difficulty ?? "",
              durationDays: tour.durationDays ?? undefined,
              tourPackages: buildEditorTourPackages(
                (tour as { tourPackages?: unknown }).tourPackages,
                (tour as { priceOptions?: unknown }).priceOptions,
                tour.price,
              ),
              featured: tour.featured ?? false,
              minPeople: Number.isFinite(Number(tour.minPeople)) && Number(tour.minPeople) > 0 ? Number(tour.minPeople) : 1,
            }))
          : [];

        setAllTours(remoteTours);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(mergedCategories));
        localStorage.setItem(LOCAL_TOURS_KEY, JSON.stringify(remoteTours));
      })
      .catch(() => {
        const categoriesFallback = localCategories.length ? localCategories : fallbackCategories;
        setCategories(categoriesFallback);
        if (!categoryId && categoriesFallback[0]) setCategoryId(categoriesFallback[0].id);
        setAllTours(localTours);
      });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated]);

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

  const handleUploadImages = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const selected = Array.from(files);
    const converted = await Promise.all(selected.map((file) => compressImage(file)));
    setImageList((prev) => [...prev, ...converted]);
  };

  const removeImage = (index: number) => {
    setImageList((prev) => prev.filter((_, i) => i !== index));
  };

  const resetTourForm = () => {
    setEditingTourId(null);
    setTitle("");
    setDescription("");
    setMinPeople(1);
    setImageList([]);
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
    setTourPackages([defaultPackage]);
    setOpenPackageIds([defaultPackage.id]);
    setPackageOpenMode("multiple");
    setIncludedText("");
    setRecommendationsText("");
    setFaqsList([]);
    setAvailabilityList(defaultAvailabilityItems);
    setFaqQuestionInput("");
    setFaqAnswerInput("");
    setAvailabilityDateInput("");
    setAvailabilityMaxPeopleInput(10);
    setStatus("BORRADOR");
    setFeatured(false);
    if (categories[0]) setCategoryId(categories[0].id);
  };

  const handleAddTourPackage = () => {
    const nextPackage = createEmptyTourPackage();
    setTourPackages((prev) => [...prev, nextPackage]);
    setOpenPackageIds((prev) => {
      if (packageOpenMode === "single") return [nextPackage.id];
      return [...prev, nextPackage.id];
    });
  };

  const handleRemoveTourPackage = (packageId: string) => {
    if (tourPackages.length <= 1) {
      setFeedback({ type: "error", message: "Cada tour debe tener al menos un paquete." });
      return;
    }
    setTourPackages((prev) => prev.filter((pkg) => pkg.id !== packageId));
    setOpenPackageIds((prev) => prev.filter((id) => id !== packageId));
  };

  const togglePackageExpanded = (packageId: string) => {
    setOpenPackageIds((prev) => {
      const isCurrentlyOpen = prev.includes(packageId);
      if (isCurrentlyOpen) return prev.filter((id) => id !== packageId);
      if (packageOpenMode === "single") return [packageId];
      return [...prev, packageId];
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
        if (pkg.id !== packageId) return pkg;
        return {
          ...pkg,
          priceOptions: pkg.priceOptions.map((option) => ({ ...option, isBase: option.id === optionId })),
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
      prev.map((pkg) =>
        pkg.id === packageId
          ? { ...pkg, priceOptions: pkg.priceOptions.filter((option) => option.id !== optionId) }
          : pkg,
      ),
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

  const handleAddAvailability = () => {
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

    const existing = availabilityList.find((item) => item.date.slice(0, 10) === keyDate);
    if (existing) {
      setAvailabilityList((prev) =>
        prev.map((item) => (item.id === existing.id ? { ...item, maxPeople } : item)),
      );
      setAvailabilityDateInput("");
      setAvailabilityMaxPeopleInput(10);
      return;
    }

    const nextId = availabilityList.length
      ? Math.max(...availabilityList.map((item) => item.id)) + 1
      : 1;
    setAvailabilityList((prev) => [...prev, { id: nextId, date: isoDate, maxPeople }]);
    setAvailabilityDateInput("");
    setAvailabilityMaxPeopleInput(10);
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
      setAllTours(items);
      localStorage.setItem(LOCAL_TOURS_KEY, JSON.stringify(items));
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
    if (!imageList.length) {
      setFeedback({ type: "error", message: "Sube al menos una imagen para el tour." });
      return false;
    }

    const category = categories.find((c) => c.id === categoryId);
    const payloadCategory = category ? { id: category.id, name: category.name } : { id: 0, name: "Sin categoria" };

    const hasInvalidPackage = tourPackages.some((pkg) => {
      const packageTitle = pkg.title.trim();
      const packageOptions = preparePriceOptionsForPayload(pkg.priceOptions);
      return !packageTitle || packageOptions.length === 0;
    });

    if (hasInvalidPackage) {
      setFeedback({
        type: "error",
        message: "Cada paquete debe tener titulo y al menos un tipo de precio valido.",
      });
      return false;
    }

    const preparedTourPackages = tourPackages
      .map((pkg) => ({
        id: String(pkg.id || "").trim(),
        title: pkg.title.trim(),
        description: pkg.description.trim(),
        priceOptions: preparePriceOptionsForPayload(pkg.priceOptions),
      }))
      .filter((pkg) => pkg.id && pkg.title && pkg.priceOptions.length > 0);

    if (preparedTourPackages.length === 0) {
      setFeedback({
        type: "error",
        message: "Debes tener al menos un paquete con precios para guardar el tour.",
      });
      return false;
    }

    const effectiveBasePrice = getPrimaryPriceFromPackages(preparedTourPackages, 0);

    const payload = {
      title,
      description,
      price: effectiveBasePrice,
      minPeople: Number.isFinite(Number(minPeople)) && Number(minPeople) > 0 ? Math.floor(Number(minPeople)) : 1,
      images: imageList,
      category: payloadCategory,
      includedItems: parseMultilineList(includedText),
      recommendations: parseMultilineList(recommendationsText),
      faqs: sanitizeFaqs(faqsList),
      availability: [...availabilityList].sort((a, b) => a.date.localeCompare(b.date)),
      status,
      isDeleted: false,
      deletedAt: null,
      country: country || undefined,
      zone: zone || undefined,
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

    if (editingTourId) {
      try {
        const res = await fetch("/api/admin/tour", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTourId,
            title,
            description,
            price: payload.price,
            minPeople: payload.minPeople,
            images: imageList,
            categoryId,
            status,
            country: payload.country,
            zone: payload.zone,
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
            availability: [...availabilityList].sort((a, b) => a.date.localeCompare(b.date)),
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
      } catch {
        setFeedback({ type: "error", message: "Error de conexion al actualizar el tour en la base de datos." });
        return false;
      }

      updatedTours = updatedTours.map((tour) => (tour.id === editingTourId ? { ...tour, ...payload } : tour));
      setFeedback({ type: "success", message: "Tour actualizado correctamente." });
    } else {
      let createdId = nextId(updatedTours);
      try {
        const res = await fetch("/api/admin/tour", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            price: payload.price,
            minPeople: payload.minPeople,
            images: imageList,
            categoryId,
            status,
            country: payload.country,
            zone: payload.zone,
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
            availability: [...availabilityList].sort((a, b) => a.date.localeCompare(b.date)),
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

      updatedTours = [{ id: createdId, ...payload }, ...updatedTours];
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
  };

  const handleEditTour = (tour: TourAdminView) => {
    const editorTourPackages = buildEditorTourPackages(
      (tour as { tourPackages?: unknown }).tourPackages,
      tour.priceOptions,
      tour.price,
    );

    setEditingTourId(tour.id);
    setTitle(tour.title);
    setDescription(tour.description);
    setMinPeople(typeof tour.minPeople === "number" && tour.minPeople > 0 ? tour.minPeople : 1);
    setImageList(tour.images || []);
    setCategoryId(tour.category?.id ?? null);
    setCountry(tour.country || "");
    setZone(tour.zone || "");
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
    setAvailabilityList(getEffectiveAvailability(tour));
    setFaqQuestionInput("");
    setFaqAnswerInput("");
    setAvailabilityDateInput("");
    setAvailabilityMaxPeopleInput(10);
    setStatus(tour.status ?? "BORRADOR");
    setFeatured(Boolean(tour.featured));
    const nextEditor: TourEditorState = {
      editingTourId: tour.id,
      title: tour.title,
      description: tour.description,
      minPeople: typeof tour.minPeople === "number" && tour.minPeople > 0 ? tour.minPeople : 1,
      imageList: tour.images || [],
      categoryId: tour.category?.id ?? null,
      country: tour.country || "",
      zone: tour.zone || "",
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
      availabilityList: getEffectiveAvailability(tour),
      status: tour.status ?? "BORRADOR",
      featured: Boolean(tour.featured),
    };
    setEditorInitial(nextEditor);
    setInlineCategoryName("");
    setIsEditorOpen(true);
  };

  const handleCloseEditor = async () => {
    if (editorHasChanges) {
      const shouldSave = window.confirm("Hay cambios sin guardar. Deseas guardar antes de cerrar?");
      if (shouldSave) {
        const saved = await handleCreateOrUpdateTour();
        if (!saved) return;
      }
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

  const handleDeleteTour = (tourId: number) => {
    const confirmDelete = window.confirm("Este tour se movera a la papelera. Deseas continuar?");
    if (!confirmDelete) return;

    const nextTours = allTours.map((tour) =>
      tour.id === tourId
        ? { ...tour, isDeleted: true, deletedAt: new Date().toISOString(), status: "NO_ACTIVO" as TourStatus }
        : tour,
    );
    const saved = saveToursLocal(nextTours);
    if (!saved) return;
    if (editingTourId === tourId) {
      resetTourForm();
      setIsEditorOpen(false);
      setEditorInitial(null);
    }
    setFeedback({ type: "success", message: "Tour enviado a papelera." });
  };

  const handleRestoreTour = (tourId: number) => {
    const confirmRestore = window.confirm("Se reactivara este tour y volvera a estar visible. Deseas continuar?");
    if (!confirmRestore) return;

    const nextTours = allTours.map((tour) =>
      tour.id === tourId
        ? { ...tour, isDeleted: false, deletedAt: null, status: "ACTIVO" as TourStatus }
        : tour,
    );
    const saved = saveToursLocal(nextTours);
    if (!saved) return;
    setFeedback({ type: "success", message: "Tour reactivado correctamente." });
  };

  const handlePermanentDeleteTour = (tourId: number) => {
    const confirmDelete = window.confirm("Esta accion eliminara el tour de forma permanente. Deseas continuar?");
    if (!confirmDelete) return;

    const nextTours = allTours.filter((tour) => tour.id !== tourId);
    const saved = saveToursLocal(nextTours);
    if (!saved) return;
    if (editingTourId === tourId) {
      resetTourForm();
      setIsEditorOpen(false);
      setEditorInitial(null);
    }
    setFeedback({ type: "success", message: "Tour eliminado permanentemente." });
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

  const handleSaveFilterConfig = () => {
    localStorage.setItem(FILTER_CONFIG_KEY, JSON.stringify(filterConfig));
    setFeedback({ type: "success", message: "Configuracion de filtros guardada." });
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

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTour, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedTours = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tabTours.slice(start, start + itemsPerPage);
  }, [tabTours, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!isEditorRoute || isAuthChecking || !isAuthenticated) return;

    const idParam = searchParams?.get("id") ?? null;
    if (idParam) {
      const targetId = Number(idParam);
      if (!Number.isFinite(targetId)) {
        setFeedback({ type: "error", message: "El tour a editar no es valido." });
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
        setFeedback({ type: "error", message: "No se encontro el tour solicitado para editar." });
        router.push("/admin");
      }
      return;
    }

    if (!isEditorOpen || editingTourId !== null) {
      openCreateTour();
    }
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Gestion de tours</h2>
            <p className="mt-1 text-sm text-slate-600">Lista compacta para administrar tus tours rapidamente.</p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <input
              value={searchTour}
              onChange={(e) => setSearchTour(e.target.value)}
              placeholder="Buscar por nombre, pais o actividad"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 md:w-80"
            />
            <button type="button" onClick={() => setIsFilterConfigOpen(true)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Filtros visibles
            </button>
            <button type="button" onClick={() => setIsCategoryManagerOpen(true)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Categorias
            </button>
            <button type="button" onClick={() => openEditorRoute()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600">
              Nuevo tour
            </button>
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
                <th className="px-3 py-3">Tour</th>
                <th className="px-3 py-3">Categoria</th>
                <th className="px-3 py-3">{activeTab === "PAPELERA" ? "Eliminado" : "Estado"}</th>
                <th className="px-3 py-3">Precio</th>
                <th className="px-3 py-3">Pais</th>
                <th className="px-3 py-3">Zona</th>
                <th className="px-3 py-3">Actividad</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedTours.map((tour) => (
                <tr key={tour.id}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <img src={tour.images?.[0]} alt={tour.title} className="h-12 w-16 rounded-md object-cover" />
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
                  <td colSpan={8} className="px-3 py-5 text-center text-slate-500">
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
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">{editingTourId ? `Editar tour #${editingTourId}` : "Crear tour"}</h2>
                <p className="text-sm text-slate-600">Estructura limpia: lo principal al centro y configuraciones al panel derecho.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleCloseEditor} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {isEditorRoute ? "Volver al listado" : "Cerrar editor"}
                </button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleCreateOrUpdateTour();
              }}
              className="space-y-4"
            >
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Principal</p>
                <div className="grid gap-3">
                  <label className="block text-sm font-bold text-slate-700">
                    Titulo
                    <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Titulo" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Descripcion
                    <textarea className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Descripcion" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
                  </label>
                </div>
              </section>

              <details open className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-800">Paquetes y tipos de precio</summary>
                <div className="mt-3 space-y-4">
                  <div className="rounded-xl bg-emerald-50/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-emerald-900">Cada tour debe tener al menos un paquete</p>
                      <button
                        type="button"
                        onClick={handleAddTourPackage}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Crear paquete
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Cada paquete requiere titulo y al menos un tipo de precio valido. La descripcion es opcional.
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

                  <div className="space-y-3">
                    {tourPackages.map((pkg, pkgIndex) => {
                      const isExpanded = openPackageIds.includes(pkg.id);

                      return (
                        <div key={pkg.id} className="rounded-xl border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => togglePackageExpanded(pkg.id)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                          >
                            <div>
                              <p className="text-sm font-extrabold text-slate-900">{pkg.title.trim() || `Paquete ${pkgIndex + 1}`}</p>
                              {!isExpanded && pkg.description.trim() && (
                                <p className="mt-0.5 text-sm text-slate-500">{pkg.description}</p>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-emerald-700">{isExpanded ? "Ocultar" : "Mostrar"}</span>
                          </button>

                          {isExpanded && (
                            <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-slate-800">Configuracion del paquete</p>
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

                              <div className="rounded-lg border border-slate-200">
                                {pkg.priceOptions.map((option) => (
                                  <div key={`${pkg.id}-${option.id}`} className="grid gap-2 border-b border-slate-100 bg-white p-3 last:border-b-0 md:grid-cols-[1.25fr_160px_auto_auto_auto] md:items-center">
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
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        disabled={option.isFree}
                                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:bg-slate-100"
                                        value={option.price}
                                        onChange={(e) => handlePackagePriceOptionChange(pkg.id, option.id, "price", e.target.value)}
                                        placeholder="0.00"
                                      />
                                    </label>

                                    <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={option.isFree}
                                        onChange={(e) => handlePackageTogglePriceOptionFree(pkg.id, option.id, e.target.checked)}
                                      />
                                      Gratis
                                    </label>

                                    <label className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                      <input
                                        type="radio"
                                        name={`base-price-option-${pkg.id}`}
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

              <details open className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-slate-700">Galeria</summary>
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Imagenes del tour</p>
                  <input type="file" accept="image/*" multiple className="mt-2 w-full text-sm" onChange={(e) => handleUploadImages(e.target.files)} />

                  {imageList.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      {imageList.map((image, index) => (
                        <div key={`${image.slice(0, 20)}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <img src={image} alt={`preview-${index}`} className="h-24 w-full object-cover" />
                          <button type="button" onClick={() => removeImage(index)} className="absolute right-1 top-1 rounded bg-white/90 px-1 text-xs font-bold text-rose-600">
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              <details open className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-800">Contenido del tour</summary>
                <div className="mt-3 grid gap-3">
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

              <details open className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-800">Preguntas frecuentes</summary>
                <div className="mt-3">
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
                      <div key={`${faq.question}-${index}`} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
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
                    <div className="mt-3 rounded-xl border border-slate-300 bg-slate-100 p-3">
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

              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-800">Fechas disponibles</summary>
                <div className="mt-3">
                <p className="text-sm font-bold text-slate-700">Fechas disponibles</p>
                <p className="text-xs text-slate-500">Agrega fechas del calendario con cupo maximo por fecha.</p>

                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_160px_auto]">
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
                    Cupo
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                      value={availabilityMaxPeopleInput}
                      onChange={(e) => setAvailabilityMaxPeopleInput(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Cupo"
                    />
                  </label>
                  <button type="button" onClick={handleAddAvailability} className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                    Agregar fecha
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {availabilityList
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((item) => (
                      <div key={`${item.id}-${item.date}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm text-slate-700">
                          {new Date(item.date).toLocaleDateString("es-ES")} | Cupo: {item.maxPeople}
                        </p>
                        <button type="button" onClick={() => handleRemoveAvailability(item.id)} className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-bold text-rose-600">
                          Quitar
                        </button>
                      </div>
                    ))}
                  {availabilityList.length === 0 && <p className="text-xs text-slate-500">No hay fechas configuradas.</p>}
                </div>
                </div>
              </details>

              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={handleCloseEditor} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">
                  Cancelar
                </button>
                <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-500">
                  Guardar
                </button>
              </div>
            </form>
          </article>

          <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">Publicacion</p>
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
              <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                Marcar como destacado
              </label>
              <button
                type="button"
                onClick={async () => {
                  await handleCreateOrUpdateTour();
                }}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-500"
              >
                Guardar
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">Categoria</p>
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

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">Detalles adicionales</p>
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
                  <span>{key}</span>
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
                onClick={() => {
                  handleSaveFilterConfig();
                  setIsFilterConfigOpen(false);
                }}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
              >
                Guardar
              </button>
            </div>
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
                          className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600"
                        >
                          Guardar
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
