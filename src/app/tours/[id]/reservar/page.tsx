"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface Availability {
  id: number;
  date: string;
  maxPeople: number;
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
  title?: string;
  images?: string[];
  price?: number;
  minPeople?: number;
  tourPackages?: TourPackage[];
  priceOptions?: TourPriceOption[];
  availability?: Availability[];
}

const LOCAL_TOURS_KEY = "toursAdminLocalTours";

interface TourLite {
  id: number;
  title: string;
  image: string;
  price: number;
  minPeople: number;
  tourPackages: TourPackage[];
}

const timeOptions = ["9:00 AM", "12:00 PM", "3:00 PM"];

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

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
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

function getVisiblePriceOptions(options: TourPriceOption[], fallbackPrice: number): TourPriceOption[] {
  const visible = options.filter((item) => item.name.trim() && (item.isFree || Number.isFinite(item.price)));
  if (visible.length) return visible;

  return [
    {
      id: "default-general",
      name: "General",
      price: fallbackPrice,
      isFree: false,
    },
  ];
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

  const fallbackPrice = typeof tour.price === "number" && Number.isFinite(tour.price) ? tour.price : 0;
  return [
    {
      id: "package-main",
      title: "Paquete principal",
      description: "",
      priceOptions: [
        {
          id: "general",
          name: "General",
          price: fallbackPrice,
          isFree: fallbackPrice === 0,
          isBase: true,
        },
      ],
    },
  ];
}

export default function ReservarPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tourId = typeof params?.id === "string" ? params.id : "";
  const packageFromQuery = searchParams?.get("package") ?? null;

  const [tour, setTour] = useState<TourLite | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState(timeOptions[0]);
  const [priceQuantities, setPriceQuantities] = useState<Record<string, number>>({});
  const [showPassengerPanel, setShowPassengerPanel] = useState(false);
  const [step, setStep] = useState<"contacto" | "pago">("contacto");

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [hotel, setHotel] = useState("");
  const [payMethod, setPayMethod] = useState("Tarjeta de Credito o Debito");

  const [status, setStatus] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(15 * 60);

  useEffect(() => {
    if (!tourId) return;

    const localTours = safeParse<LocalTourAvailability[]>(localStorage.getItem(LOCAL_TOURS_KEY), []);
    const localTour = localTours.find((item) => String(item.id) === tourId);
    const localAvailability = Array.isArray(localTour?.availability)
      ? localTour.availability.filter((item) => item?.date && Number(item?.maxPeople) > 0)
      : [];

    if (localAvailability.length) {
      const sortedLocal = [...localAvailability].sort((a, b) => a.date.localeCompare(b.date));
      setAvailability(sortedLocal);
      setSelectedDateId(sortedLocal[0]?.id ?? null);
      if (sortedLocal[0]) {
        const first = new Date(sortedLocal[0].date);
        setVisibleMonth(new Date(first.getFullYear(), first.getMonth(), 1));
      }
    }

    if (localTour) {
      setTour({
        id: localTour.id,
        title: localTour.title || "Tour",
        image: Array.isArray(localTour.images) && localTour.images[0] ? localTour.images[0] : "",
        price: typeof localTour.price === "number" ? localTour.price : 0,
        minPeople: Math.max(1, Number(localTour.minPeople) || 1),
        tourPackages: buildNormalizedPackages(localTour),
      });
    }

    fetch(`/api/availability?tourId=${tourId}`)
      .then((res) => res.json())
      .then((data) => {
        const next = Array.isArray(data) ? data : [];
        setAvailability(next);
        setSelectedDateId(next[0]?.id ?? null);
        if (next[0]) {
          const first = new Date(next[0].date);
          setVisibleMonth(new Date(first.getFullYear(), first.getMonth(), 1));
        }
      })
      .catch(() => {
        const next = localAvailability;
        setAvailability(next);
        setSelectedDateId(next[0]?.id ?? null);
        if (next[0]) {
          const first = new Date(next[0].date);
          setVisibleMonth(new Date(first.getFullYear(), first.getMonth(), 1));
        }
        setLoadError("No se pudo cargar la disponibilidad del tour desde el servidor.");
      });

    fetch(`/api/tour?id=${tourId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.id) {
          setTour({
            id: data.id,
            title: data.title,
            image: Array.isArray(data.images) && data.images[0] ? data.images[0] : "",
            price: typeof data.price === "number" ? data.price : 0,
            minPeople: Math.max(1, Number(data.minPeople) || 1),
            tourPackages: buildNormalizedPackages(data),
          });
          setLoadError("");
          return;
        }
        setTour(null);
        setLoadError("No se encontro informacion del tour solicitado en el servidor.");
      })
      .catch(() => {
        setTour(null);
        setLoadError("No se pudo cargar la informacion del tour desde el servidor.");
      });
  }, [tourId]);

  useEffect(() => {
    if (!tour) return;
    const availablePackages = tour.tourPackages || [];

    if (!availablePackages.length) {
      setSelectedPackageId(null);
      return;
    }

    if (packageFromQuery && availablePackages.some((pkg) => pkg.id === packageFromQuery)) {
      setSelectedPackageId(packageFromQuery);
      return;
    }

    if (!selectedPackageId || !availablePackages.some((pkg) => pkg.id === selectedPackageId)) {
      setSelectedPackageId(availablePackages[0].id);
    }
  }, [tour, packageFromQuery, selectedPackageId]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const visiblePriceOptions = useMemo(() => {
    if (!tour) return [];
    const selectedPackage = (tour.tourPackages || []).find((pkg) => pkg.id === selectedPackageId) || null;
    const sourceOptions = selectedPackage?.priceOptions || [];
    return getVisiblePriceOptions(sourceOptions, tour.price);
  }, [tour, selectedPackageId]);

  const selectedPackage = useMemo(() => {
    if (!tour?.tourPackages?.length) return null;
    return tour.tourPackages.find((pkg) => pkg.id === selectedPackageId) || tour.tourPackages[0] || null;
  }, [tour?.tourPackages, selectedPackageId]);

  useEffect(() => {
    if (!visiblePriceOptions.length) return;

    setPriceQuantities((prev) => {
      const next: Record<string, number> = {};
      visiblePriceOptions.forEach((option) => {
        next[option.id] = prev[option.id] ?? 0;
      });

      const totalSelected = Object.values(next).reduce((acc, value) => acc + value, 0);
      if (totalSelected === 0) {
        const baseOption = visiblePriceOptions.find((option) => option.isBase);
        next[(baseOption || visiblePriceOptions[0]).id] = 1;
      }

      return next;
    });
  }, [visiblePriceOptions]);

  const totalPeople = useMemo(
    () => visiblePriceOptions.reduce((acc, option) => acc + (priceQuantities[option.id] ?? 0), 0),
    [priceQuantities, visiblePriceOptions],
  );

  const subtotal = useMemo(
    () => visiblePriceOptions.reduce((acc, option) => acc + (priceQuantities[option.id] ?? 0) * option.price, 0),
    [priceQuantities, visiblePriceOptions],
  );
  const serviceFee = useMemo(() => subtotal * 0.06, [subtotal]);
  const total = useMemo(() => subtotal + serviceFee, [subtotal, serviceFee]);

  const selectedDate = useMemo(
    () => availability.find((item) => item.id === selectedDateId) ?? availability[0],
    [availability, selectedDateId],
  );

  const availabilityByDateKey = useMemo(() => {
    const map = new Map<string, Availability>();
    availability.forEach((item) => {
      const key = toDateKey(new Date(item.date));
      if (!map.has(key)) map.set(key, item);
    });
    return map;
  }, [availability]);

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

  const countdownLabel = useMemo(() => {
    const min = Math.floor(remainingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = (remainingSeconds % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  }, [remainingSeconds]);

  const canContinueToPay =
    name.trim() && lastName.trim() && email.trim() && emailConfirm.trim() && email === emailConfirm && phone.trim() && hotel.trim();
  const minimumPeople = Math.max(1, tour?.minPeople ?? 1);
  const meetsMinimumPeople = totalPeople >= minimumPeople;

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();

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
        name: option.name,
        unitPrice: option.price,
        isFree: option.isFree,
        quantity: priceQuantities[option.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);

    try {
      const res = await fetch("/api/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourId,
          availabilityId: selectedDate?.id,
          people,
          selectedPrices,
          name,
          lastName,
          email,
          emailConfirm,
          phone,
          hotel,
          paymentMethod: payMethod,
          scheduleTime: selectedTime,
          packageId: selectedPackage?.id,
          packageTitle: selectedPackage?.title,
        }),
      });

      if (res.ok) {
        setStatus("Reserva confirmada. Te enviamos el detalle por correo.");
        return;
      }

      const errorData = await res.json().catch(() => null);
      setStatus(errorData?.error ? `No se pudo confirmar la reserva: ${errorData.error}` : "No se pudo confirmar la reserva.");
    } catch {
      setStatus("No se pudo confirmar la reserva por un error de conexion.");
    }
  };

  if (!tour) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Reserva tu tour</h1>
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {loadError || "No se pudo cargar la reserva porque el tour no esta disponible."}
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
            <h2 className="text-xl font-extrabold text-slate-900">Selecciona fechas y precio</h2>

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
                  onClick={() =>
                    setVisibleMonth((prev) => (prev ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1) : prev))
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700"
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
                  onClick={() =>
                    setVisibleMonth((prev) => (prev ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1) : prev))
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700"
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
                  const available = availabilityByDateKey.get(key);
                  const isActive = available?.id === selectedDateId;

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!available}
                      onClick={() => setSelectedDateId(available?.id ?? null)}
                      className={`h-10 rounded-md border text-sm font-bold transition ${
                        isActive
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : available
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400"
                            : "cursor-not-allowed border-slate-200 bg-white text-slate-300"
                      }`}
                      title={available ? `${available.maxPeople} lugares max.` : "No disponible"}
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

            <div className="mt-5 grid gap-3 md:grid-cols-[1.5fr_1fr]">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Elige el horario</label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800"
                >
                  {timeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Personas</label>
                <button
                  type="button"
                  onClick={() => setShowPassengerPanel((prev) => !prev)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left font-semibold text-slate-800"
                >
                  {totalPeople} pers.
                </button>
                {!meetsMinimumPeople && (
                  <p className="mt-2 text-xs font-bold text-rose-700">Reserva minima: {minimumPeople} personas.</p>
                )}
              </div>
            </div>

            {showPassengerPanel && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-3">
                  {visiblePriceOptions.map((option) => (
                    <div key={option.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{option.name}</p>
                        <p className={`text-sm ${option.isFree || option.price === 0 ? "font-bold text-emerald-700" : "text-slate-600"}`}>
                          {formatOptionPrice(option)} por pers.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 font-bold"
                          onClick={() =>
                            setPriceQuantities((prev) => ({
                              ...prev,
                              [option.id]: Math.max(0, (prev[option.id] ?? 0) - 1),
                            }))
                          }
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold">{priceQuantities[option.id] ?? 0}</span>
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 font-bold"
                          onClick={() =>
                            setPriceQuantities((prev) => ({
                              ...prev,
                              [option.id]: (prev[option.id] ?? 0) + 1,
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-600">Total:</p>
              <p className="text-3xl font-black text-emerald-800">{formatCurrencyUSD(total)}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Paso 1: Datos de contacto</h2>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-bold ${step === "contacto" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={() => setStep("contacto")}
              >
                Contacto
              </button>
            </div>

            {step === "contacto" && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Apellido"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <input
                  type="email"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Correo electronico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="email"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Confirmar correo"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Telefono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Hotel o lugar de hospedaje"
                  value={hotel}
                  onChange={(e) => setHotel(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setStep("pago")}
                  disabled={!canContinueToPay}
                  className="md:col-span-2 mt-2 rounded-lg bg-emerald-700 px-4 py-3 font-extrabold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Continuar a pago
                </button>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Paso 2: Metodo de pago</h2>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-bold ${step === "pago" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={() => setStep("pago")}
              >
                Pago
              </button>
            </div>

            {step === "pago" && (
              <form onSubmit={handleReserve} className="mt-4 space-y-3">
                {["Tarjeta de Credito o Debito", "3 y 6 Meses sin Intereses", "PayPal"].map((method) => (
                  <button
                    type="button"
                    key={method}
                    onClick={() => setPayMethod(method)}
                    className={`w-full rounded-lg border px-4 py-3 text-left font-semibold transition ${
                      payMethod === method
                        ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                        : "border-slate-300 bg-white text-slate-700 hover:border-emerald-300"
                    }`}
                  >
                    {method}
                  </button>
                ))}

                <button
                  type="submit"
                  disabled={totalPeople <= 0 || !meetsMinimumPeople}
                  className="mt-3 w-full rounded-lg bg-amber-400 px-4 py-3 text-base font-extrabold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Confirmar reserva y pagar
                </button>
              </form>
            )}

            {status && (
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
              <p className="text-xs text-slate-600">{selectedTime} | {totalPeople} pers.</p>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-xs text-slate-600">
            {visiblePriceOptions
              .filter((option) => (priceQuantities[option.id] ?? 0) > 0)
              .map((option) => (
                <p key={`summary-${option.id}`}>
                  {option.name}: {priceQuantities[option.id] ?? 0} x {formatOptionPrice(option)}
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
