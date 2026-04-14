import Link from "next/link";

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
        className={`rounded-3xl border p-6 shadow-sm ${
          isPendingValidation ? "border-[rgba(250,178,79,0.2)] bg-[#202630]/92" : "border-white/10 bg-[#202630]/92"
        }`}
      >
        <p
          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            isPendingValidation ? "bg-[var(--brand-gold)] text-[#11151c]" : "bg-[var(--brand-green)] text-white"
          }`}
        >
          {isPendingValidation ? "Pendiente de validacion" : "Confirmada"}
        </p>

        <h1 className="mt-4 text-3xl font-black text-white">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-300">{subtitle}</p>
        {shouldShowSummary ? <p className="mt-3 text-sm text-slate-300">{summary}</p> : null}

        <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-[#171c24] p-4 text-sm text-slate-300 sm:grid-cols-2">
          <p>
            <span className="font-bold text-white">Reserva:</span>{" "}
            {reservationId ? `#${reservationId}` : "Por asignar"}
          </p>
          <p>
            <span className="font-bold text-white">Metodo de pago:</span>{" "}
            {paymentMethod || "No indicado"}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/tours"
            className="rounded-full bg-[var(--brand-gold)] px-4 py-2 text-sm font-bold text-[#11151c] transition hover:brightness-105"
          >
            Ver experiencias
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/[0.15] bg-white/[0.08] px-4 py-2 text-sm font-bold text-white transition hover:bg-white/[0.12]"
          >
            Ir al inicio
          </Link>
        </div>
      </article>
    </section>
  );
}
