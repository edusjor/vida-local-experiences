export default function QuienesSomos() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600 text-white shadow-2xl shadow-emerald-900/20">
        <div className="grid gap-8 p-6 md:grid-cols-[1.3fr_1fr] md:p-10">
          <div>
            <p className="inline-block rounded-full border border-white/35 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]">Nuestra identidad</p>
            <h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl">Misión, Visión y Valores</h1>
            <p className="mt-4 text-lg text-emerald-50">
              Lo que nos mueve, lo que proyectamos y la forma en que cuidamos cada viaje.
            </p>
          </div>

          <div className="rounded-2xl border border-white/25 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-100">Compromiso central</p>
            <p className="mt-3 text-2xl font-extrabold">Seguridad, organización y experiencias memorables.</p>
            <p className="mt-3 text-emerald-50">No solo planificamos viajes. Diseñamos experiencias donde cada detalle importa.</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Misión</p>
          <h2 className="mt-2 text-3xl font-extrabold text-emerald-900">Nuestra Misión</h2>
          <p className="mt-4 leading-relaxed text-slate-700">
            Garantizar experiencias de viaje tan bien organizadas, seguras y memorables, que cada persona que confíe en nosotros regrese con la tranquilidad de haber tomado la decisión correcta y con recuerdos que permanecerán para siempre.
          </p>
          <p className="mt-4 leading-relaxed text-slate-700">No solo planificamos viajes.</p>
          <p className="mt-2 leading-relaxed text-slate-700">
            Diseñamos experiencias donde la seguridad, la confianza y el cuidado en cada detalle permiten que nuestros viajeros disfruten sin preocupaciones y vivan momentos que realmente valen la pena recordar.
          </p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Visión</p>
          <h2 className="mt-2 text-3xl font-extrabold text-emerald-900">Nuestra Visión</h2>
          <p className="mt-4 leading-relaxed text-slate-700">
            Posicionarnos como la agencia que marca la diferencia en el mercado, reconocida por garantizar seguridad, calidad y organización profesional en cada viaje.
          </p>
          <p className="mt-4 leading-relaxed text-slate-700">
            Queremos ser el referente para quienes buscan más que un destino: buscan confianza, estructura y la certeza de estar en manos responsables que respetan su tiempo, su inversión y su etapa de vida.
          </p>
        </article>
      </div>

      <article className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Valores</p>
        <h2 className="mt-2 text-3xl font-extrabold text-emerald-900">🤝 Nuestros Valores</h2>
        <p className="mt-4 text-slate-700">
          En cada experiencia que organizamos, nuestros valores no son solo palabras; son el fundamento sobre el cual construimos la confianza de cada viajero.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-lg font-extrabold text-emerald-800">🔹 Honestidad</p>
            <p className="mt-2 text-slate-700">
              Comunicamos cada detalle con claridad y transparencia. Desde el precio hasta lo que incluye cada tour, creemos que la confianza comienza con información clara y sin sorpresas.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-lg font-extrabold text-emerald-800">🔹 Respeto</p>
            <p className="mt-2 text-slate-700">
              Respetamos tu tiempo, tu inversión y tu etapa de vida. Valoramos cada decisión que tomas al elegir viajar con nosotros y cuidamos cada experiencia como si fuera propia.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-lg font-extrabold text-emerald-800">🔹 Honradez</p>
            <p className="mt-2 text-slate-700">
              Actuamos con integridad en cada proceso. Cumplimos lo que prometemos y trabajamos con estructura profesional para que cada reserva, pago y servicio tenga respaldo real.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-lg font-extrabold text-emerald-800">🔹 Empatía</p>
            <p className="mt-2 text-slate-700">
              Entendemos que cada viajero vive un momento diferente. Escuchamos, acompañamos y orientamos con sensibilidad, porque sabemos que detrás de cada viaje hay una historia personal.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <p className="text-lg font-extrabold text-emerald-800">🔹 Solidaridad</p>
            <p className="mt-2 text-slate-700">
              Fomentamos un ambiente de comunidad donde cada persona pueda sentirse acompañada, segura y parte del grupo desde el primer momento.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}