type SearchParams = {
  reserva?: string;
  estado?: string;
  metodo?: string;
  mensaje?: string;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function ReservaConfirmadaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const reservationId = firstValue(params.reserva).trim();
  const status = firstValue(params.estado).trim().toLowerCase();
  const paymentMethod = firstValue(params.metodo).trim();
  const message = firstValue(params.mensaje).trim();

  const isPendingValidation = status === "pending_validation";
  const title = isPendingValidation ? "Reserva Recibida" : "Reserva Confirmada";
  const subtitle = isPendingValidation
    ? "Tu reserva quedo registrada con estado pendiente de validacion."
    : "Tu pago fue validado y tu reserva quedo confirmada.";
  const summary =
    message ||
    (isPendingValidation
      ? "Nuestro equipo validara el comprobante SINPE y te notificaremos por correo."
      : "Te enviamos la confirmacion al correo registrado.");
  const normalizedSubtitle = normalizeComparableText(subtitle);
  const normalizedSummary = normalizeComparableText(summary);
  const shouldShowSummary = isPendingValidation && normalizedSummary.length > 0 && normalizedSummary !== normalizedSubtitle;

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <article
        className={`rounded-2xl border p-6 shadow-sm ${
          isPendingValidation ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <p
          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            isPendingValidation ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"
          }`}
        >
          {isPendingValidation ? "Pendiente de validacion" : "Confirmada"}
        </p>

        <h1 className="mt-4 text-3xl font-black text-slate-900">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-700">{subtitle}</p>
        {shouldShowSummary ? <p className="mt-3 text-sm text-slate-700">{summary}</p> : null}

        <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-bold text-slate-900">Reserva:</span>{" "}
            {reservationId ? `#${reservationId}` : "Por asignar"}
          </p>
          <p>
            <span className="font-bold text-slate-900">Metodo de pago:</span>{" "}
            {paymentMethod || "No indicado"}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href="/tours"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Ver mas tours
          </a>
          <a
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400"
          >
            Ir al inicio
          </a>
        </div>
      </article>
    </section>
  );
}
