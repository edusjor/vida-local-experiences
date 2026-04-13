"use client";

import React from 'react';
import Link from 'next/link';
import ContactUnifiedForm from '../components/ContactUnifiedForm';

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.62a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.46-1.2a2 2 0 0 1 2.11-.45c.84.3 1.72.51 2.62.63A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15 15 0 0 1 0 20" />
      <path d="M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function ContactoPage() {
  return (
    <div>
      <section className="jungle-band py-12 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-4xl font-extrabold">Contactanos directamente</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <h3 className="text-2xl font-extrabold">Canales de atencion</h3>
              <div className="mt-4 space-y-3 text-sm font-semibold text-emerald-50">
                <p className="flex items-center gap-2"><PhoneIcon /> +506 6015 9782 / +506 7154 6738</p>
                <p className="flex items-center gap-2"><MailIcon /> atencionalcliente@guapileslineatours.com</p>
                <p className="flex items-center gap-2"><ClockIcon /> Lunes a Viernes, 8:00 am a 5:00 pm</p>
                <p className="flex items-center gap-2"><MapPinIcon /> Costa Rica, Limon, Pococi, La Colonia</p>
              </div>
            </article>

            <article className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <h3 className="text-2xl font-extrabold">Contactanos por WhatsApp</h3>
              <p className="mt-3 text-emerald-50">
                Escribenos al +506 6015 9782 y te ayudamos a elegir tour, fechas y metodo de pago en minutos.
              </p>
              <a
                href="https://wa.me/50660159782"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block rounded-lg bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-amber-300"
              >
                Abrir WhatsApp
              </a>
            </article>
          </div>
        </div>
      </section>

      <section id="centro-contacto" className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold text-emerald-900">Listo para planear tu aventura</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <ContactUnifiedForm className="grid gap-4 md:grid-cols-2" />
            </div>

            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4882.188570334864!2d-83.8047022!3d10.2454627!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8fa0b9c803e1fc55%3A0x4b43d6084e269201!2sLINEA%20TOURS%20-%20Agencia%20de%20Viajes!5e1!3m2!1ses!2scr!4v1774907290615!5m2!1ses!2scr"
                width="400"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-56 w-full"
                title="Mapa de LINEA TOURS"
              />
              <div className="space-y-2 p-4 text-sm text-slate-700">
                <p className="flex items-center gap-2"><MapPinIcon /> Guapiles, Limon, Costa Rica</p>
                <p className="flex items-center gap-2"><ShieldIcon /> Operadores certificados y respaldo local</p>
                <p className="flex items-center gap-2"><GlobeIcon /> Experiencias rurales, playa y aventura</p>
                <Link href="/contacto" className="mt-2 inline-block font-extrabold text-emerald-700">Ver contacto completo</Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
