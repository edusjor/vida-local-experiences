"use client";

import React from "react";
import { phoneCountryOptions } from "../../lib/phoneCountryOptions";

export default function ContactUnifiedForm({
  className = "grid gap-4 md:grid-cols-2",
}: {
  className?: string;
}) {
  const [nombre, setNombre] = React.useState("");
  const [phoneCountryDialCode, setPhoneCountryDialCode] = React.useState("");
  const [telefono, setTelefono] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [mensaje, setMensaje] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !phoneCountryDialCode || !telefono.trim() || !mensaje.trim()) {
      setStatus("Please complete all required fields.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Sending message...");

    try {
      const fullPhone = telefono.trim() ? `${phoneCountryDialCode} ${telefono.trim()}`.trim() : "";

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: fullPhone,
          asunto: "General inquiry",
          email: email.trim(),
          mensaje: mensaje.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(data?.error || "Your inquiry could not be sent. Please try again.");
        return;
      }

      setStatus("Message sent successfully. We will get back to you soon to plan your experience.");
      setNombre("");
      setPhoneCountryDialCode("");
      setTelefono("");
      setEmail("");
      setMensaje("");
    } catch {
      setStatus("Your inquiry could not be sent due to a connection error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form className={className} onSubmit={handleSubmit}>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-slate-200">Name</span>
          <input
            type="text"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-[var(--brand-gold)] focus:outline-none"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-slate-200">Email</span>
          <input
            type="email"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-[var(--brand-gold)] focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <div className="grid gap-2 md:col-span-2 sm:grid-cols-[1fr_1.8fr]">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-200">Country code</span>
            <select
              className="w-full rounded-xl border border-white/10 bg-[#1c232d] px-3 py-2.5 text-white focus:border-[var(--brand-gold)] focus:outline-none"
              value={phoneCountryDialCode}
              onChange={(e) => setPhoneCountryDialCode(e.target.value)}
              required
            >
              <option value="">Select</option>
              {phoneCountryOptions.map((option) => (
                <option key={`${option.code}-${option.dialCode}`} value={option.dialCode}>
                  {option.name} ({option.dialCode})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-200">Phone</span>
            <input
              type="text"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-[var(--brand-gold)] focus:outline-none"
              placeholder="Number"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-slate-200">Mensaje</span>
          <textarea
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-[var(--brand-gold)] focus:outline-none"
            rows={5}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="md:col-span-2 rounded-xl bg-[var(--brand-gold)] px-4 py-3 text-base font-extrabold text-[#11151c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
        >
          {isSubmitting ? "Sending..." : "Send inquiry"}
        </button>
      </form>

      {status && <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-sm font-semibold text-slate-100">{status}</div>}
    </>
  );
}
