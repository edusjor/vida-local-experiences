import ValuesCompact from "../components/ValuesCompact";
import { siteConfig } from "../../lib/siteConfig";

const ABOUT_IMAGES = {
  hero: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2200&q=80",
  heart: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1200&q=80",
  values: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=80",
};

const VALUES = [
  {
    title: "Authenticity",
    text: "We design experiences that reflect the real Costa Rica - guided by locals, rooted in tradition, and created with intention.",
  },
  {
    title: "Community Connection",
    text: "We collaborate with local families and small community projects, creating shared opportunities that honor culture and support the region.",
  },
  {
    title: "Nature Respect",
    text: "Every experience is designed to be low-impact, responsible, and aligned with the natural rhythm of the Pacific coast.",
  },
  {
    title: "Meaningful Travel",
    text: "We believe travel becomes unforgettable when it creates real moments - stories, flavors, and encounters that stay with you long after you leave.",
  },
];

export default function QuienesSomos() {
  return (
    <section className="relative overflow-hidden pb-16 text-white md:pb-24">
      <div className="pointer-events-none absolute -left-24 top-32 h-64 w-64 rounded-full bg-[var(--brand-gold)]/18 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-[var(--brand-sky)]/15 blur-3xl" />

      <div className="relative h-[340px] overflow-hidden md:h-[440px]">
        <img src={ABOUT_IMAGES.hero} alt="Pacific coast in Costa Rica" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/35 to-[#121820]/88" />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-4 pb-8 text-white md:pb-12">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--brand-gold)]">{siteConfig.brandName}</p>
          <h1 className="mt-2 text-4xl font-black md:text-6xl">About Us</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold text-slate-100 md:text-base">
            We create private and authentic experiences that connect travelers with Costa Rica's nature, culture, and people.
          </p>
        </div>
      </div>

      <div className="relative mx-auto mt-6 max-w-6xl px-4 md:mt-8">
        <article className="grid overflow-hidden rounded-[28px] border border-white/10 bg-[#202630]/92 shadow-[0_24px_64px_rgba(0,0,0,0.22)] backdrop-blur lg:grid-cols-[1.06fr_1fr]">
          <div className="relative min-h-[280px] lg:min-h-[440px]">
            <img src={ABOUT_IMAGES.heart} alt="Local hosts in Costa Rica" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-gold)]">The Heart of the Pacific</p>
              <p className="mt-2 text-lg font-extrabold">A purpose-driven initiative for private and authentic tours.</p>
            </div>
          </div>

          <div className="p-6 md:p-8 lg:p-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-gold)]">Our Story</p>
            <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">The Heart of the Pacific</h2>
            <p className="mt-5 leading-relaxed text-slate-300">
              Vida Local Experiences began with a shared passion for Costa Rica's Pacific Coast - its nature, its communities, and the authentic way of life that makes this region unlike any other.
            </p>
            <p className="mt-4 leading-relaxed text-slate-300">
              Our team arrived in Manuel Antonio, Dominical, and Uvita at different times in life, each drawn by the ocean, the rainforest, and the sense of belonging that this part of Costa Rica naturally offers.
            </p>
            <p className="mt-4 leading-relaxed text-slate-300">
              For more than a decade, we have worked in hospitality and tourism, exploring the region deeply and sharing our favorite places with travelers searching for authentic Costa Rica experiences beyond standard tours.
            </p>
            <p className="mt-4 leading-relaxed text-slate-300">
              Through these encounters, we realized something essential: travel becomes unforgettable when guided by people who genuinely love the place they call home.
            </p>
            <p className="mt-4 leading-relaxed text-slate-300">
              This belief shaped the foundation of Vida Local Experiences - a purpose-driven initiative dedicated to creating private and authentic tours across Manuel Antonio, Dominical, and Uvita.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#171c24] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-gold)]">Destinations</p>
                <p className="mt-2 text-lg font-extrabold text-white">Manuel Antonio, Dominical and Uvita</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#171c24] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-gold)]">Focus</p>
                <p className="mt-2 text-lg font-extrabold text-white">Private and authentic experiences</p>
              </div>
            </div>
          </div>
        </article>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-[#202630]/92 p-6 shadow-sm md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-gold)]">Why Choose Vida Local Experiences</p>
            <h3 className="mt-2 text-3xl font-black text-white">Authentic Experiences, Not Tourist Tours</h3>
            <p className="mt-4 leading-relaxed text-slate-300">
              We don't sell tours - we create real, locally lead experiences that connect you with Costa Rica's nature, culture, and people.
            </p>
            <p className="mt-3 leading-relaxed text-slate-300">
              Every moment is designed with intention, rooted in genuine local knowledge.
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-[#202630]/92 p-6 shadow-sm md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-gold)]">Private Experience</p>
            <h3 className="mt-2 text-3xl font-black text-white">Truly Private and Personal</h3>
            <p className="mt-4 leading-relaxed text-slate-300">
              Our experiences are 100% private - not shared, not semi-private.
            </p>
            <p className="mt-3 leading-relaxed text-slate-300">
              You explore at your own pace, with space to enjoy meaningful moments with your partner, friends, or family.
            </p>
          </article>
        </div>

        <section className="mt-8 grid overflow-hidden rounded-[28px] border border-white/10 bg-[#202630]/92 shadow-[0_18px_48px_rgba(0,0,0,0.2)] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 md:p-8">
            <h3 className="text-3xl font-black text-white">The People Behind Our Experiences</h3>
            <p className="mt-4 leading-relaxed text-slate-300">
              Our experiences are created hand-in-hand with the people who make this region unique - families who care for the land, cooks who preserve recipes passed down for generations, and locals who know every river, trail, and story by heart.
            </p>
            <p className="mt-3 leading-relaxed text-slate-300">
              Many of these families don't always have visibility within Costa Rica's tourism industry. One of our core values is creating space for their traditions, knowledge, and cultural identity to be shared.
            </p>
            <p className="mt-3 leading-relaxed text-slate-300">
              When you visit a farm, taste traditional food, or listen to stories shared around a table, you support local culture in a way that feels genuine, respectful, and deeply human.
            </p>
            <p className="mt-3 leading-relaxed text-slate-300">
              This is our way of connecting travelers with real Costa Rica: opening doors, creating opportunities, and keeping living traditions alive through meaningful encounters.
            </p>
          </div>
          <div className="min-h-[320px] lg:min-h-full">
            <img src={ABOUT_IMAGES.values} alt="Costa Rica rainforest and waterfall" className="h-full w-full object-cover" />
          </div>
        </section>

        <ValuesCompact items={VALUES} />

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#202630]/92 p-6 shadow-sm md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-gold)]">Our Impact</p>
          <p className="mt-3 max-w-4xl leading-relaxed text-slate-300">
            We work side-by-side with local families, farmers, and community partners across Manuel Antonio, Dominical, and Uvita - creating opportunities, sharing visibility, and helping keep living traditions alive through responsible travel.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#171c24] p-5 text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--brand-gold)]">Discover Costa Rica Through Real Connections.</p>
            <p className="mt-2 text-lg font-extrabold text-white">When You're Ready, We'll Help You Plan Your Trip.</p>
          </div>
        </section>
      </div>
    </section>
  );
}