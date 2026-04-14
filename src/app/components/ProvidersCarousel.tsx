type ProviderLogo = {
  src: string;
  name: string;
};

type ProvidersCarouselProps = {
  logos: ProviderLogo[];
};

export default function ProvidersCarousel({ logos }: ProvidersCarouselProps) {
  if (!logos.length) return null;

  const minimumBaseItems = Math.max(12, logos.length * 4);
  const baseItems = Array.from({ length: minimumBaseItems }, (_, index) => logos[index % logos.length]);
  const trackItems = [...baseItems, ...baseItems];

  return (
    <section className="bg-transparent py-10 md:py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="rounded-3xl border border-white/10 bg-[#202630]/92 p-5 shadow-sm md:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-gold)]">Alianzas</p>
              <h2 className="mt-1 text-2xl font-extrabold text-white md:text-3xl">Nuestra red local</h2>
            </div>
            <p className="text-sm font-semibold text-slate-400">Familias, anfitriones y aliados que hacen posible cada experiencia</p>
          </div>

          <div className="provider-tape" aria-label="Carrusel de proveedores">
            <div className="provider-tape-track">
              {trackItems.map((logo, index) => (
                <div key={`${logo.src}-${index}`} className="provider-logo-card" title={logo.name} aria-label={logo.name}>
                  <img
                    src={logo.src}
                    alt={logo.name}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-full object-contain md:h-16"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}