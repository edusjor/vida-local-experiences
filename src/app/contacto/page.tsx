"use client";

import Link from 'next/link';
import ContactUnifiedForm from '../components/ContactUnifiedForm';
import { siteConfig } from '../../lib/siteConfig';

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
          <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-gold)]">Contact</p>
          <h2 className="mt-3 text-center text-4xl font-extrabold">Let's talk about your trip to Costa Rica</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
              <h3 className="text-2xl font-extrabold">Contact channels</h3>
              <div className="mt-4 space-y-3 text-sm font-semibold text-emerald-50">
                <p className="flex items-center gap-2"><PhoneIcon /> WhatsApp {siteConfig.whatsappDisplay}</p>
                <p className="flex items-center gap-2"><MailIcon /> {siteConfig.supportEmail}</p>
                <p className="flex items-center gap-2"><ClockIcon /> Personalized support to define route, pace, and interests</p>
                <p className="flex items-center gap-2"><MapPinIcon /> {siteConfig.location}</p>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
              <h3 className="text-2xl font-extrabold">Personalized planning</h3>
              <p className="mt-3 text-emerald-50">
                Tell us what you would love to experience in Costa Rica, and we will help you build a private, authentic journey aligned with your trip.
              </p>
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block rounded-full bg-[var(--brand-gold)] px-5 py-2.5 text-sm font-extrabold text-[#11151c] transition hover:brightness-105"
              >
                Open WhatsApp
              </a>
            </article>
          </div>
        </div>
      </section>

      <section id="centro-contacto" className="section-band py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold text-white">When you are ready, we will help you plan it</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="rounded-[28px] border border-white/10 bg-[#202630]/92 p-5 shadow-sm">
              <ContactUnifiedForm className="grid gap-4 md:grid-cols-2" />
            </div>

            <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-[#202630]/92 shadow-sm">
              <iframe
                src={siteConfig.mapsEmbedUrl}
                width="400"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-56 w-full"
                title="Map of Manuel Antonio"
              />
              <div className="space-y-2 p-5 text-sm text-slate-200">
                <p className="flex items-center gap-2"><MapPinIcon /> {siteConfig.location}</p>
                <p className="flex items-center gap-2"><ShieldIcon /> Private experiences with local guidance</p>
                <p className="flex items-center gap-2"><GlobeIcon /> Nature, culture, and community at the heart of your journey</p>
                <Link href="/tours" className="mt-2 inline-block font-extrabold text-[var(--brand-gold)]">Explore experiences</Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
