"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ReservationItem = {
  id: number;
  tourId: number;
  tour: {
    id: number;
    title: string;
  };
  people: number;
  date: string;
  name: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  hotel: string | null;
  paymentMethod: string | null;
  sinpeReceiptUrl: string | null;
  scheduleTime: string | null;
  paid: boolean;
  createdAt: string;
  totalAmount?: number | null;
  packageTitle?: string | null;
  priceBreakdown?: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
};

type SortBy = "createdAt" | "date";
type SortOrder = "asc" | "desc";
type PaymentFilter = "all" | "card" | "sinpe";
type StatusFilter = "all" | "pending" | "paid";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CR");
}

function formatDateLong(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const day = new Intl.DateTimeFormat("es-CR", { day: "numeric", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("es-CR", { month: "long", timeZone: "UTC" }).format(date);
  const year = new Intl.DateTimeFormat("es-CR", { year: "numeric", timeZone: "UTC" }).format(date);
  return `${day} ${month}, ${year}`;
}

function formatReservedDate(value: string): string {
  return formatDateLong(value);
}

function formatScheduleLabel(value: string | null): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.toLowerCase() === "por coordinar") return "Por coordinar";

  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const meridiem = hours >= 12 ? "p. m." : "a. m.";
      const hour12 = hours % 12 || 12;
      return `${hour12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
    }
  }

  return normalized;
}

function formatPriceDetail(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "N/D";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AdminOrdersPage() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingReservationId, setUpdatingReservationId] = useState<number | null>(null);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [activeReservation, setActiveReservation] = useState<ReservationItem | null>(null);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsAuthChecking(false));
  }, []);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ sortBy, order, payment: paymentFilter, status: statusFilter });
      const res = await fetch(`/api/admin/reservations?${query.toString()}`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        setReservations([]);
        return;
      }
      if (!res.ok) {
        setFeedback({ type: "error", message: "No se pudieron cargar los pedidos." });
        setReservations([]);
        return;
      }

      const data = (await res.json()) as { reservations?: ReservationItem[] };
      setReservations(Array.isArray(data.reservations) ? data.reservations : []);
      setFeedback(null);
    } catch {
      setFeedback({ type: "error", message: "Error de red al cargar pedidos." });
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadReservations();
  }, [isAuthenticated, sortBy, order, paymentFilter, statusFilter]);

  const updateSinpeStatus = async (reservationId: number, status: "pending" | "paid") => {
    setUpdatingReservationId(reservationId);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId, status }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({
          type: "error",
          message: payload?.error ? `No se pudo actualizar la reserva #${reservationId}: ${payload.error}` : `No se pudo actualizar la reserva #${reservationId}.`,
        });
        return;
      }

      setFeedback({
        type: "success",
        message: `Reserva #${reservationId} actualizada a ${status === "paid" ? "pagado" : "pendiente"}.`,
      });
      await loadReservations();
      setActiveReservation((prev) => (prev && prev.id === reservationId ? { ...prev, paid: status === "paid" } : prev));
    } catch {
      setFeedback({ type: "error", message: `Error de red actualizando la reserva #${reservationId}.` });
    } finally {
      setUpdatingReservationId(null);
    }
  };

  const title = useMemo(() => {
    if (sortBy === "createdAt") {
      return order === "desc"
        ? "Ordenadas por fecha de ingreso (mas recientes primero)"
        : "Ordenadas por fecha de ingreso (mas antiguas primero)";
    }

    return order === "desc"
      ? "Ordenadas por fecha reservada (mas recientes primero)"
      : "Ordenadas por fecha reservada (mas antiguas primero)";
  }, [order, sortBy]);

  if (isAuthChecking) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">Verificando sesion de administrador...</p>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-rose-800">Sesion requerida</h1>
          <p className="mt-2 text-sm font-semibold text-rose-700">Debes iniciar sesion como administrador para ver los pedidos.</p>
          <Link href="/admin" className="mt-4 inline-flex rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600">
            Ir al login admin
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 p-6 text-white">
        <h1 className="text-3xl font-extrabold">Pedidos / Reservas</h1>
        <p className="mt-1 text-sm text-emerald-100">Revisa reservas y comprobantes SINPE en un solo lugar.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link href="/admin" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Volver al panel
        </Link>
        <label className="text-sm font-semibold text-slate-700">Ordenar por</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="createdAt">Fecha de ingreso</option>
          <option value="date">Fecha reservada</option>
        </select>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as SortOrder)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="desc">Descendente</option>
          <option value="asc">Ascendente</option>
        </select>
        <label className="text-sm font-semibold text-slate-700">Metodo</label>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="card">Tarjeta (solo pagados)</option>
          <option value="sinpe">SINPE</option>
        </select>
        <label className="text-sm font-semibold text-slate-700">Estado</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="paid">Pagados</option>
        </select>
        <button
          type="button"
          onClick={() => void loadReservations()}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-600"
        >
          Actualizar
        </button>
      </div>

      <p className="mb-4 text-sm font-semibold text-slate-600">{title}</p>

      {feedback ? (
        <p className={`mb-4 rounded-xl p-3 text-sm font-semibold ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {feedback.message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-slate-600">#</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Fecha reservada</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Tour</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Contacto</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Total</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Pago</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Creada</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center font-semibold text-slate-500">Cargando pedidos...</td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center font-semibold text-slate-500">No hay pedidos registrados.</td>
                </tr>
              ) : (
                reservations.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-extrabold text-slate-800">#{item.id}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>{formatReservedDate(item.date)}</p>
                      <p className="text-xs font-semibold text-slate-500">Hora reservada: {formatScheduleLabel(item.scheduleTime)}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-800">{item.tour?.title || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <p className="font-semibold text-slate-900">{[item.name, item.lastName].filter(Boolean).join(" ")}</p>
                      <p>{item.email}</p>
                      <p>{item.phone || "Sin telefono"}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <p className="font-extrabold text-emerald-800">{formatPriceDetail(item.totalAmount)}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <p className="font-semibold">{item.paymentMethod || "No indicado"}</p>
                      <p className={item.paid ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                        {item.paid ? "Pago exitoso" : "Pendiente"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(item.createdAt)}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <button
                        type="button"
                        onClick={() => setActiveReservation(item)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-800"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeReservation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Reserva #{activeReservation.id}</h2>
                <p className="text-sm font-semibold text-slate-600">Detalle completo de la reserva</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveReservation(null)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fecha reservada</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatReservedDate(activeReservation.date)}</p>
                <p className="text-sm text-slate-600">Hora reservada: {formatScheduleLabel(activeReservation.scheduleTime)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Creada</p>
                <p className="mt-1 text-sm font-medium text-slate-600">{formatDateTime(activeReservation.createdAt)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tour</p>
                <p className="mt-1 font-semibold text-slate-900">{activeReservation.tour?.title || "-"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cliente</p>
                <p className="mt-1 font-semibold text-slate-900">{[activeReservation.name, activeReservation.lastName].filter(Boolean).join(" ")}</p>
                <p className="text-sm text-slate-700">{activeReservation.email}</p>
                <p className="text-sm text-slate-700">{activeReservation.phone || "Sin telefono"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Hospedaje</p>
                <p className="mt-1 font-semibold text-slate-900">{activeReservation.hotel || "Sin hospedaje"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pago</p>
                <p className="mt-1 font-semibold text-slate-900">{activeReservation.paymentMethod || "No indicado"}</p>
                <p className={activeReservation.paid ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-amber-700"}>
                  {activeReservation.paid ? "Pago exitoso" : "Pendiente"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total pagado</p>
                <p className="mt-1 text-xl font-black text-emerald-800">{formatPriceDetail(activeReservation.totalAmount)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cantidad de personas</p>
                <p className="mt-1 text-xl font-black text-slate-900">{activeReservation.people}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Paquete</p>
                <p className="mt-1 font-semibold text-slate-900">{activeReservation.packageTitle || "No indicado"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Detalle de seleccion</p>
                {Array.isArray(activeReservation.priceBreakdown) && activeReservation.priceBreakdown.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {activeReservation.priceBreakdown.map((row) => (
                      <li key={`${activeReservation.id}-${row.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <span className="font-semibold text-slate-900">{row.name}</span>
                        <span className="ml-2">x {row.quantity}</span>
                        {row.totalPrice ? (
                          <span className="ml-2 font-semibold text-emerald-700">({formatPriceDetail(row.totalPrice)})</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">No hay detalle guardado para esta reserva.</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Comprobante SINPE</p>
                {activeReservation.paymentMethod?.toLowerCase() === "sinpe movil" && activeReservation.sinpeReceiptUrl ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <a href={activeReservation.sinpeReceiptUrl} target="_blank" rel="noreferrer" className="block w-40 overflow-hidden rounded-lg border border-emerald-300 bg-white">
                      <img src={activeReservation.sinpeReceiptUrl} alt={`Comprobante SINPE reserva ${activeReservation.id}`} className="h-28 w-full object-cover" />
                    </a>
                    <a href={activeReservation.sinpeReceiptUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100">
                      Abrir imagen completa
                    </a>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">No aplica</p>
                )}
              </div>
            </div>

            {activeReservation.paymentMethod?.toLowerCase() === "sinpe movil" ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={updatingReservationId === activeReservation.id || activeReservation.paid}
                  onClick={() => void updateSinpeStatus(activeReservation.id, "paid")}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {updatingReservationId === activeReservation.id ? "Actualizando..." : "Marcar pagado"}
                </button>
                <button
                  type="button"
                  disabled={updatingReservationId === activeReservation.id || !activeReservation.paid}
                  onClick={() => void updateSinpeStatus(activeReservation.id, "pending")}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Volver a pendiente
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
