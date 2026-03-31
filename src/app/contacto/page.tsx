"use client";

import React from 'react';
import ContactUnifiedForm from '../components/ContactUnifiedForm';

export default function ContactoPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 px-6 py-10 text-white md:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">Guapiles Linea Tours Support</p>
        <h1 className="mt-2 text-4xl font-black md:text-5xl">Hablemos de tu proxima aventura</h1>
        <p className="mt-3 max-w-2xl text-emerald-100">
          Nuestro equipo te ayuda a elegir el tour ideal, resolver dudas de fechas y preparar una experiencia a medida.
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Telefono</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-800">+506 7154-6738</p>
          <p className="mt-2 text-sm text-slate-600">Atencion de lunes a domingo de 8:00 AM a 5:00 PM.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Email</p>
          <a href="mailto:atencionalcliente@guapileslineatours.com" className="mt-2 block text-xl font-extrabold text-emerald-800 underline underline-offset-4">
            atencionalcliente@guapileslineatours.com
          </a>
          <p className="mt-2 text-sm text-slate-600">Respuestas en menos de 24 horas habiles.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Oficina</p>
          <p className="mt-2 text-xl font-extrabold text-emerald-800">Quepos, Costa Rica</p>
          <p className="mt-2 text-sm text-slate-600">Citas presenciales bajo coordinacion previa.</p>
        </article>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-extrabold text-slate-900">Envianos tu consulta</h2>
          <p className="mt-2 text-sm text-slate-600">Completa el formulario y te contactamos rapidamente con opciones sugeridas.</p>

          <div className="mt-5">
            <ContactUnifiedForm className="grid gap-4 md:grid-cols-2" />
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-extrabold text-slate-900">Preguntas frecuentes</h3>
            <div className="mt-3 space-y-2">
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">Cuanto tardan en responder?</summary>
                <p className="mt-2 text-sm text-slate-600">Entre 2 y 24 horas segun la carga de solicitudes.</p>
              </details>
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">Puedo pedir tours a medida?</summary>
                <p className="mt-2 text-sm text-slate-600">Si, creamos itinerarios personalizados para tu grupo y presupuesto.</p>
              </details>
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">Atienden por WhatsApp?</summary>
                <p className="mt-2 text-sm text-slate-600">Si, al escribirnos por telefono te guiamos por ese canal.</p>
              </details>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
