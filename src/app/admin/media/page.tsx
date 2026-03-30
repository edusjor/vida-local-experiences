"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type LinkedTour = {
  id: number;
  title: string;
};

type MediaStatus = "active" | "trash";

type MediaItem = {
  id: string;
  status: MediaStatus;
  name: string;
  relativePath: string;
  url: string;
  extension: string;
  size: number;
  updatedAt: string;
  isImage: boolean;
  linkedTours: LinkedTour[];
};

type ApiResponse = {
  items: MediaItem[];
  summary: {
    active: number;
    trash: number;
    linked: number;
    unlinked: number;
  };
};

type LinkFilter = "all" | "linked" | "unlinked";

type ViewMode = "list" | "grid";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-ES");
}

export default function AdminMediaPage() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MediaStatus>("active");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsAuthChecking(false));
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/media");
      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        setItems([]);
        return;
      }
      if (!res.ok) {
        setFeedback({ type: "error", message: "No se pudo cargar la biblioteca de medios." });
        setItems([]);
        return;
      }

      const data = (await res.json()) as ApiResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setFeedback(null);
    } catch {
      setFeedback({ type: "error", message: "Error de red al cargar la biblioteca de medios." });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadItems();
  }, [isAuthenticated]);

  useEffect(() => {
    setSelectedIds([]);
    setPreviewItem(null);
  }, [statusFilter]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items
      .filter((item) => item.status === statusFilter)
      .filter((item) => {
        if (statusFilter !== "active") return true;
        if (linkFilter === "linked") return item.linkedTours.length > 0;
        if (linkFilter === "unlinked") return item.linkedTours.length === 0;
        return true;
      })
      .filter((item) => {
        if (!query) return true;
        return `${item.name} ${item.relativePath}`.toLowerCase().includes(query);
      });
  }, [items, linkFilter, search, statusFilter]);

  const allVisibleSelected = useMemo(() => {
    if (!visibleItems.length) return false;
    return visibleItems.every((item) => selectedIds.includes(item.id));
  }, [selectedIds, visibleItems]);

  const summary = useMemo(() => {
    const active = items.filter((item) => item.status === "active");
    const trash = items.filter((item) => item.status === "trash");
    return {
      active: active.length,
      trash: trash.length,
      linked: active.filter((item) => item.linkedTours.length > 0).length,
      unlinked: active.filter((item) => item.linkedTours.length === 0).length,
    };
  }, [items]);

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      const allIds = Array.from(new Set([...selectedIds, ...visibleItems.map((item) => item.id)]));
      setSelectedIds(allIds);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !visibleItems.some((item) => item.id === id)));
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((itemId) => itemId !== id);
    });
  };

  const selectedInCurrentStatus = selectedIds.filter((id) => {
    const item = items.find((candidate) => candidate.id === id);
    return item?.status === statusFilter;
  });

  const executeAction = async (action: "trash" | "restore" | "delete") => {
    if (!selectedInCurrentStatus.length) {
      setFeedback({ type: "error", message: "Selecciona al menos un elemento." });
      return;
    }

    const confirmMessage =
      action === "trash"
        ? `Mover ${selectedInCurrentStatus.length} elemento(s) a papelera?`
        : action === "restore"
          ? `Restaurar ${selectedInCurrentStatus.length} elemento(s)?`
          : `Eliminar permanentemente ${selectedInCurrentStatus.length} elemento(s)? Esta accion no se puede deshacer.`;

    const accepted = window.confirm(confirmMessage);
    if (!accepted) return;

    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ids: selectedInCurrentStatus,
        }),
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setFeedback({ type: "error", message: "Sesion expirada. Inicia sesion nuevamente." });
        return;
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setFeedback({ type: "error", message: payload?.error || "No se pudo completar la accion." });
        return;
      }

      setSelectedIds([]);
      setPreviewItem(null);
      await loadItems();
      setFeedback({
        type: "success",
        message:
          action === "trash"
            ? "Elementos enviados a papelera."
            : action === "restore"
              ? "Elementos restaurados."
              : "Elementos eliminados permanentemente.",
      });
    } catch {
      setFeedback({ type: "error", message: "Error de red al ejecutar la accion." });
    }
  };

  if (isAuthChecking) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-10">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-600">Verificando sesion...</p>
        </article>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-10">
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-2xl font-extrabold text-rose-900">Sesion no valida</h1>
          <p className="mt-2 text-sm font-semibold text-rose-700">Debes iniciar sesion como administrador para gestionar medios.</p>
          <Link href="/admin" className="mt-4 inline-flex rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600">
            Ir al login admin
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">Biblioteca de medios</h1>
            <p className="mt-1 text-sm text-emerald-100">Gestiona imagenes y otros archivos, con papelera y control de uso por tour.</p>
          </div>
          <Link href="/admin" className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold hover:bg-white/30">
            Volver al panel
          </Link>
        </div>
      </div>

      {feedback && (
        <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {feedback.message}
        </p>
      )}

      <article className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Activos</p>
            <p className="text-xl font-black text-slate-900">{summary.active}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">En papelera</p>
            <p className="text-xl font-black text-slate-900">{summary.trash}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ligados</p>
            <p className="text-xl font-black text-slate-900">{summary.linked}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">No ligados</p>
            <p className="text-xl font-black text-slate-900">{summary.unlinked}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${statusFilter === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
          >
            Activos
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("trash")}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${statusFilter === "trash" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}
          >
            Papelera
          </button>

          {statusFilter === "active" && (
            <>
              <button
                type="button"
                onClick={() => setLinkFilter("all")}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${linkFilter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setLinkFilter("linked")}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${linkFilter === "linked" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Ligados
              </button>
              <button
                type="button"
                onClick={() => setLinkFilter("unlinked")}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${linkFilter === "unlinked" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                No ligados
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${viewMode === "list" ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-700"}`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${viewMode === "grid" ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-700"}`}
          >
            Miniaturas
          </button>

          <button type="button" onClick={() => void loadItems()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
            Recargar
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xl rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Buscar por nombre o ruta..."
          />
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            disabled={!selectedIds.length}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Limpiar seleccion
          </button>

          {statusFilter === "active" ? (
            <button
              type="button"
              onClick={() => void executeAction("trash")}
              disabled={!selectedInCurrentStatus.length}
              className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-50"
            >
              Enviar a papelera ({selectedInCurrentStatus.length})
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void executeAction("restore")}
                disabled={!selectedInCurrentStatus.length}
                className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
              >
                Restaurar ({selectedInCurrentStatus.length})
              </button>
              <button
                type="button"
                onClick={() => void executeAction("delete")}
                disabled={!selectedInCurrentStatus.length}
                className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
              >
                Borrar permanente ({selectedInCurrentStatus.length})
              </button>
            </>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Cargando medios...</p>
          ) : visibleItems.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">No hay medios para los filtros actuales.</p>
          ) : viewMode === "list" ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[52px_88px_1fr_120px_140px] items-center bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <span>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                    aria-label="Seleccionar todos"
                  />
                </span>
                <span>Vista</span>
                <span>Archivo</span>
                <span>Tamano</span>
                <span>Actualizado</span>
              </div>

              {visibleItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[52px_88px_1fr_120px_140px] items-center gap-2 border-t border-slate-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(e) => toggleSelectOne(item.id, e.target.checked)}
                  />

                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="group relative h-14 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                  >
                    {item.isImage ? (
                      <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="inline-flex h-full w-full items-center justify-center text-[11px] font-bold text-slate-600">Archivo</span>
                    )}
                  </button>

                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">/{item.relativePath}</p>
                    {item.status === "active" ? (
                      <p className={`mt-1 text-xs font-semibold ${item.linkedTours.length ? "text-emerald-700" : "text-amber-700"}`}>
                        {item.linkedTours.length
                          ? `Ligado a: ${item.linkedTours.map((tour) => tour.title).join(", ")}`
                          : "No ligado a ningun tour"}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-slate-500">En papelera</p>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-600">{formatBytes(item.size)}</p>
                  <p className="text-xs font-semibold text-slate-600">{formatDate(item.updatedAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                />
                <span className="text-xs font-semibold text-slate-600">Seleccionar todos los visibles</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {visibleItems.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="relative h-36 bg-slate-100">
                      {item.isImage ? (
                        <button type="button" onClick={() => setPreviewItem(item)} className="h-full w-full">
                          <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setPreviewItem(item)} className="inline-flex h-full w-full items-center justify-center text-sm font-bold text-slate-600">
                          Archivo
                        </button>
                      )}
                      <label className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-xs font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(e) => toggleSelectOne(item.id, e.target.checked)}
                          className="mr-1"
                        />
                        Selec.
                      </label>
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="truncate text-sm font-extrabold text-slate-900">{item.name}</p>
                      <p className="truncate text-[11px] text-slate-500">/{item.relativePath}</p>
                      <p className="text-[11px] font-semibold text-slate-600">{formatBytes(item.size)} · {formatDate(item.updatedAt)}</p>
                      {item.status === "active" && (
                        <p className={`text-[11px] font-semibold ${item.linkedTours.length ? "text-emerald-700" : "text-amber-700"}`}>
                          {item.linkedTours.length ? `Ligado (${item.linkedTours.length})` : "No ligado"}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4" onClick={() => setPreviewItem(null)}>
          <article className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-extrabold text-slate-900">{previewItem.name}</p>
                <p className="text-xs text-slate-500">/{previewItem.relativePath}</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700" onClick={() => setPreviewItem(null)}>
                Cerrar
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto bg-slate-100 p-4">
              {previewItem.isImage ? (
                <img src={previewItem.url} alt={previewItem.name} className="mx-auto h-auto max-h-[70vh] max-w-full rounded-xl object-contain" />
              ) : (
                <div className="rounded-xl bg-white p-6 text-sm font-semibold text-slate-700">
                  <p>Vista previa no disponible para este tipo de archivo.</p>
                  <p className="mt-2">Ruta: /{previewItem.relativePath}</p>
                  <a href={previewItem.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
                    Abrir archivo
                  </a>
                </div>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
