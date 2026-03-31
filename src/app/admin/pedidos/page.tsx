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
};

type SortBy = "createdAt" | "date";
type SortOrder = "asc" | "desc";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CR");
}

function formatScheduleLabel(value: string | null): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.toLowerCase() === "por coordinar") return "Sin hora";
  return normalized;
}

export default function AdminOrdersPage() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [reservations, setReservations] = useState<ReservationItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsAuthChecking(false));
  }, []);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ sortBy, order });
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
  }, [isAuthenticated, sortBy, order]);

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
                <th className="px-3 py-2 text-left font-bold text-slate-600">Ingreso</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Fecha reservada</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Tour</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Contacto</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Pago</th>
                <th className="px-3 py-2 text-left font-bold text-slate-600">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center font-semibold text-slate-500">Cargando pedidos...</td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center font-semibold text-slate-500">No hay pedidos registrados.</td>
                </tr>
              ) : (
                reservations.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-extrabold text-slate-800">#{item.id}</td>
                    <td className="px-3 py-3 text-slate-700">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>{formatDate(item.date)}</p>
                      <p className="text-xs font-semibold text-slate-500">Hora: {formatScheduleLabel(item.scheduleTime)}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-800">{item.tour?.title || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <p className="font-semibold text-slate-900">{[item.name, item.lastName].filter(Boolean).join(" ")}</p>
                      <p>{item.email}</p>
                      <p>{item.phone || "Sin telefono"}</p>
                      <p>{item.hotel || "Sin hospedaje"}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <p className="font-semibold">{item.paymentMethod || "No indicado"}</p>
                      <p className={item.paid ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>{item.paid ? "Pagado" : "Pendiente"}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.paymentMethod?.toLowerCase() === "sinpe movil" && item.sinpeReceiptUrl ? (
                        <div className="flex flex-col gap-2">
                          <a href={item.sinpeReceiptUrl} target="_blank" rel="noreferrer" className="block w-24 overflow-hidden rounded-lg border border-emerald-300 bg-white">
                            <img src={item.sinpeReceiptUrl} alt={`Comprobante SINPE reserva ${item.id}`} className="h-20 w-full object-cover" />
                          </a>
                          <a href={item.sinpeReceiptUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100">
                            Abrir imagen
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">No aplica</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
