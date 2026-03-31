"use client";

import React from "react";

type PhoneCountryOption = {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
};

const phoneCountryOptions: PhoneCountryOption[] = [
  { code: "CR", dialCode: "+506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "PA", dialCode: "+507", flag: "🇵🇦", name: "Panama" },
  { code: "NI", dialCode: "+505", flag: "🇳🇮", name: "Nicaragua" },
  { code: "HN", dialCode: "+504", flag: "🇭🇳", name: "Honduras" },
  { code: "SV", dialCode: "+503", flag: "🇸🇻", name: "El Salvador" },
  { code: "GT", dialCode: "+502", flag: "🇬🇹", name: "Guatemala" },
  { code: "MX", dialCode: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "CO", dialCode: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "CA", dialCode: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "ES", dialCode: "+34", flag: "🇪🇸", name: "Espana" },
];

export default function ContactUnifiedForm({
  className = "grid gap-4 md:grid-cols-2",
}: {
  className?: string;
}) {
  const [nombre, setNombre] = React.useState("");
  const [phoneCountryDialCode, setPhoneCountryDialCode] = React.useState("");
  const [telefono, setTelefono] = React.useState("");
  const [asunto, setAsunto] = React.useState("Consulta general");
  const [email, setEmail] = React.useState("");
  const [mensaje, setMensaje] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !mensaje.trim() || !asunto.trim()) {
      setStatus("Por favor completa todos los campos obligatorios.");
      return;
    }

    if (telefono.trim() && !phoneCountryDialCode) {
      setStatus("Selecciona un pais para el telefono.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Enviando mensaje...");

    try {
      const fullPhone = telefono.trim() ? `${phoneCountryDialCode} ${telefono.trim()}`.trim() : "";

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: fullPhone,
          asunto: asunto.trim(),
          email: email.trim(),
          mensaje: mensaje.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(data?.error || "No se pudo enviar tu consulta. Intenta nuevamente.");
        return;
      }

      setStatus("Mensaje enviado correctamente. Te responderemos en menos de 24 horas.");
      setNombre("");
      setPhoneCountryDialCode("");
      setTelefono("");
      setAsunto("Consulta general");
      setEmail("");
      setMensaje("");
    } catch {
      setStatus("No se pudo enviar tu consulta por un error de conexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form className={className} onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Nombre</span>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Asunto</span>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            required
          >
            <option>Consulta general</option>
            <option>Cotizacion personalizada</option>
            <option>Soporte de reserva</option>
            <option>Grupos y eventos</option>
          </select>
        </label>

        <div className="grid gap-2 sm:grid-cols-[1.2fr_1.8fr]">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Pais y codigo</span>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={phoneCountryDialCode}
              onChange={(e) => setPhoneCountryDialCode(e.target.value)}
            >
              <option value="">Selecciona un pais</option>
              {phoneCountryOptions.map((option) => (
                <option key={`${option.code}-${option.dialCode}`} value={option.dialCode}>
                  {option.flag} {option.name} ({option.dialCode})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Telefono (opcional)</span>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Numero"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </label>
        </div>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Mensaje</span>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={5}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="md:col-span-2 rounded-lg bg-amber-400 px-4 py-3 text-base font-extrabold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Enviando..." : "Enviar consulta"}
        </button>
      </form>

      {status && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{status}</div>}
    </>
  );
}
