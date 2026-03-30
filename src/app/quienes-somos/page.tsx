const NOSOTROS_IMAGES = {
  // Reemplaza estos links por tus archivos en /uploads, por ejemplo: "/uploads/nosotros-hero.png"
  hero: "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=1600&q=80",
  principal: "https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1200&q=80",
  galeria: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1515238152791-8216bfdf89a7?auto=format&fit=crop&w=900&q=80",
  ],
};

export default function QuienesSomos() {
  return (
    <section className="bg-[#f3f5f6] pb-10">
      <div className="relative h-[230px] overflow-hidden md:h-[280px]">
        <img src={NOSOTROS_IMAGES.hero} alt="Portada Nosotros" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-900/45" />
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-white">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black md:text-5xl">Sobre Nosotros</h1>
            <p className="mt-3 text-sm font-semibold text-slate-100 md:text-base">
              Nos dedicamos a crear viajes que priorizan el bienestar, el confort y la conexion humana.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-7xl px-4">
        <div className="grid gap-0 rounded-2xl bg-white shadow-sm lg:grid-cols-[1fr_1fr]">
          <div className="min-h-[360px] overflow-hidden rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none">
            <img src={NOSOTROS_IMAGES.principal} alt="Equipo Linea Tours" className="h-full w-full object-cover" />
          </div>

          <article className="p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Nuestra identidad</p>
            <h2 className="mt-2 text-4xl font-black text-slate-900">Quienes Somos</h2>
            <p className="mt-4 leading-relaxed text-slate-700">
              Garantizar experiencias de viaje tan bien organizadas, seguras y memorables, que cada persona que confie en nosotros regrese con la tranquilidad de haber tomado la decision correcta y con recuerdos que permaneceran para siempre.
            </p>
            <p className="mt-4 leading-relaxed text-slate-700">No solo planificamos viajes.</p>
            <p className="mt-2 leading-relaxed text-slate-700">
              Disenamos experiencias donde la seguridad, la confianza y el cuidado en cada detalle permiten que nuestros viajeros disfruten sin preocupaciones y vivan momentos que realmente valen la pena recordar.
            </p>
            <p className="mt-4 leading-relaxed text-slate-700">
              Gracias a nuestra red de mas de 35 proveedores nacionales e internacionales, ofrecemos servicios confiables,
              personalizados y pensados para que cada cliente viva un viaje memorable, lleno de naturaleza, cultura y conexion humana.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Destinos</p>
                <p className="mt-1 text-2xl font-black text-emerald-800">Naturaleza, Playa y Ciudad</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Diviertete</p>
                <p className="mt-1 text-2xl font-black text-emerald-800">Experiencias inolvidables</p>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Mision</p>
            <h2 className="mt-2 text-3xl font-extrabold text-emerald-900">Nuestra Mision</h2>
            <p className="mt-4 leading-relaxed text-slate-700">
              Garantizar experiencias de viaje tan bien organizadas, seguras y memorables, que cada persona que confie en nosotros regrese con la tranquilidad de haber tomado la decision correcta y con recuerdos que permaneceran para siempre.
            </p>
            <p className="mt-4 leading-relaxed text-slate-700">No solo planificamos viajes.</p>
            <p className="mt-2 leading-relaxed text-slate-700">
              Disenamos experiencias donde la seguridad, la confianza y el cuidado en cada detalle permiten que nuestros viajeros disfruten sin preocupaciones y vivan momentos que realmente valen la pena recordar.
            </p>
          </article>

          <article className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Vision</p>
            <h2 className="mt-2 text-3xl font-extrabold text-emerald-900">Nuestra Vision</h2>
            <p className="mt-4 leading-relaxed text-slate-700">
              Posicionarnos como la agencia que marca la diferencia en el mercado, reconocida por garantizar seguridad, calidad y organizacion profesional en cada viaje.
            </p>
            <p className="mt-4 leading-relaxed text-slate-700">
              Queremos ser el referente para quienes buscan mas que un destino: buscan confianza, estructura y la certeza de estar en manos responsables que respetan su tiempo, su inversion y su etapa de vida.
            </p>
          </article>
        </div>

        <article className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Valores</p>
          <h2 className="mt-2 text-3xl font-extrabold text-emerald-900">Nuestros Valores</h2>
          <p className="mt-4 text-slate-700">
            En cada experiencia que organizamos, nuestros valores no son solo palabras; son el fundamento sobre el cual construimos la confianza de cada viajero.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-lg font-extrabold text-emerald-800">Honestidad</p>
              <p className="mt-2 text-slate-700">
                Comunicamos cada detalle con claridad y transparencia. Desde el precio hasta lo que incluye cada tour, creemos que la confianza comienza con informacion clara y sin sorpresas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-lg font-extrabold text-emerald-800">Respeto</p>
              <p className="mt-2 text-slate-700">
                Respetamos tu tiempo, tu inversion y tu etapa de vida. Valoramos cada decision que tomas al elegir viajar con nosotros y cuidamos cada experiencia como si fuera propia.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-lg font-extrabold text-emerald-800">Honradez</p>
              <p className="mt-2 text-slate-700">
                Actuamos con integridad en cada proceso. Cumplimos lo que prometemos y trabajamos con estructura profesional para que cada reserva, pago y servicio tenga respaldo real.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-lg font-extrabold text-emerald-800">Empatia</p>
              <p className="mt-2 text-slate-700">
                Entendemos que cada viajero vive un momento diferente. Escuchamos, acompanamos y orientamos con sensibilidad, porque sabemos que detras de cada viaje hay una historia personal.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <p className="text-lg font-extrabold text-emerald-800">Solidaridad</p>
              <p className="mt-2 text-slate-700">
                Fomentamos un ambiente de comunidad donde cada persona pueda sentirse acompanada, segura y parte del grupo desde el primer momento.
              </p>
            </div>
          </div>
        </article>

        <div className="mt-8 grid grid-cols-1 gap-2 md:grid-cols-3">
          {NOSOTROS_IMAGES.galeria.map((image, idx) => (
            <div key={`${image}-${idx}`} className="overflow-hidden rounded-xl bg-slate-200">
              <img src={image} alt={`Galeria Nosotros ${idx + 1}`} className="h-44 w-full object-cover md:h-52" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}