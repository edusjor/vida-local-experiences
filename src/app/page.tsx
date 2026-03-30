import Link from "next/link";

function IconWrap({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">{children}</span>;
}

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

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 1.7 4.3L18 8l-4.3 1.7L12 14l-1.7-4.3L6 8l4.3-1.7L12 2z" />
      <path d="m19 14 1 2.4L22.4 17 20 18l-1 2.4L18 18l-2.4-1 2.4-1 1-2.4z" />
      <path d="m5 14 .8 1.8L7.6 17l-1.8.8L5 19.6l-.8-1.8L2.4 17l1.8-.8L5 14z" />
    </svg>
  );
}

export default function Home() {
  return (
    <div>
      <section className="hero-wrap">
        <div className="mx-auto max-w-6xl px-4 py-24 text-white md:py-32">
          <p className="mb-3 inline-block rounded-full border border-white/40 bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-wide">
            Guapiles Linea Tours
          </p>
          <h1 className="script-title text-5xl leading-tight drop-shadow-md md:text-7xl">Descubre el turismo rural costarricense</h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold text-slate-100 md:text-2xl">
            Experiencias unicas y autenticas dentro y fuera del pais para todos los estilos de vida.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tours"
              className="rounded-lg bg-emerald-600 px-8 py-3 text-center text-lg font-extrabold shadow-xl shadow-emerald-950/25 transition hover:bg-emerald-500"
            >
              Ver tours
            </Link>
            <Link
              href="/contacto"
              className="rounded-lg bg-amber-400 px-8 py-3 text-center text-lg font-extrabold text-slate-900 shadow-xl shadow-amber-950/25 transition hover:bg-amber-300"
            >
              Explorar planes
            </Link>
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-extrabold text-emerald-900 md:text-4xl">Turismo rural, local e internacional</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              Trabajamos junto a familias, emprendedores y comunidades locales para crear experiencias seguras y de alta calidad.
              Tambien ofrecemos circuitos internacionales con acompanamiento cercano de principio a fin.
            </p>
            <div className="mt-6 grid gap-3 text-sm font-semibold text-emerald-900 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
                <IconWrap>
                  <GlobeIcon />
                </IconWrap>
                Experiencias nacionales e internacionales
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
                <IconWrap>
                  <SparkIcon />
                </IconWrap>
                Mas de 35 aliados turisticos
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm sm:col-span-2">
                <IconWrap>
                  <ShieldIcon />
                </IconWrap>
                Atencion cercana y personalizada en cada etapa del viaje
              </div>
            </div>
          </div>
          <img
            src="https://images.unsplash.com/photo-1607748851687-ba9a10438621?auto=format&fit=crop&w=1000&q=80"
            alt="Guia local de turismo"
            className="h-72 w-full rounded-2xl object-cover shadow-xl"
          />
        </div>
      </section>

      <section className="jungle-band py-12 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold">Tours destacados</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Surf Lessons",
                place: "Manuel Antonio",
                image:
                  "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=900&q=80",
              },
              {
                title: "Pesca Deportiva",
                place: "Marina Pez Vela",
                image:
                  "https://images.unsplash.com/photo-1535591273668-578e31182c4f?auto=format&fit=crop&w=900&q=80",
              },
              {
                title: "Snorkel Privado",
                place: "Costa Pacifico",
                image:
                  "https://images.unsplash.com/photo-1560275619-4662e36fa65c?auto=format&fit=crop&w=900&q=80",
              },
            ].map((item) => (
              <article key={item.title} className="overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl shadow-emerald-950/30">
                <img src={item.image} alt={item.title} className="h-44 w-full object-cover" />
                <div className="p-4">
                  <p className="text-2xl font-extrabold text-emerald-900">{item.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-500">
                    <MapPinIcon />
                    {item.place}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-500">
                    <ClockIcon />
                    Medio dia
                  </p>
                  <Link
                    href="/tours"
                    className="mt-4 inline-block rounded-lg bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-amber-300"
                  >
                    Ver tour
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-4xl font-extrabold text-emerald-900">Por que elegir Guapiles Linea Tours</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Turismo responsable", desc: "Viajes que aportan a comunidades y tradiciones locales", icon: <GlobeIcon /> },
              { title: "Calidad y seguridad", desc: "Operadores confiables y experiencias bien coordinadas", icon: <ShieldIcon /> },
              { title: "Destinos variados", desc: "Naturaleza, playa y ciudad en una sola propuesta", icon: <MapPinIcon /> },
              { title: "Acompanamiento real", desc: "Atencion personalizada antes, durante y despues del viaje", icon: <PhoneIcon /> },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="mb-3">
                  <IconWrap>{item.icon}</IconWrap>
                </div>
                <p className="text-xl font-extrabold text-emerald-900">{item.title}</p>
                <p className="mt-2 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="jungle-band py-12 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-4xl font-extrabold">Contactanos directamente</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <h3 className="text-2xl font-extrabold">Canales de atencion</h3>
              <div className="mt-4 space-y-3 text-sm font-semibold text-emerald-50">
                <p className="flex items-center gap-2"><PhoneIcon /> +506 6015 9782 / +506 7154 6738</p>
                <p className="flex items-center gap-2"><MailIcon /> atencion.guapiles@lineatours.cr</p>
                <p className="flex items-center gap-2"><ClockIcon /> Lunes a Viernes, 8:00 am a 5:00 pm</p>
                <p className="flex items-center gap-2"><MapPinIcon /> Costa Rica, Limon, Pococi, La Colonia</p>
              </div>
            </article>

            <article className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <h3 className="text-2xl font-extrabold">Prefieres atencion guiada</h3>
              <p className="mt-3 text-emerald-50">
                Te orientamos segun tu presupuesto, tipo de experiencia y tiempo disponible para que reserves con confianza.
              </p>
              <Link
                href="/contacto"
                className="mt-5 inline-block rounded-lg bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-amber-300"
              >
                Ir al centro de contacto
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold text-emerald-900">Listo para planear tu aventura</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
            <form className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm md:grid-cols-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><MapPinIcon /></span>
                <input className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3" placeholder="Nombre" />
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><MailIcon /></span>
                <input className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3" placeholder="Email" />
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><PhoneIcon /></span>
                <input className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3" placeholder="Telefono" />
              </div>
              <textarea className="md:col-span-3 rounded-lg border border-slate-300 px-3 py-2" rows={4} placeholder="Mensaje" />
              <button
                type="button"
                className="md:col-span-3 rounded-lg bg-amber-400 px-6 py-3 font-extrabold text-slate-900 transition hover:bg-amber-300"
              >
                Enviar consulta
              </button>
            </form>

            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5ce?auto=format&fit=crop&w=900&q=80"
                alt="Ubicacion de tours"
                className="h-40 w-full object-cover"
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
