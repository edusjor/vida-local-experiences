"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FeaturedTour = {
  id: number;
  title: string;
  image: string;
  description: string;
  categoryName: string;
  priceLabel: string | null;
  location: string;
  featured: boolean;
};

type Props = {
  tours: FeaturedTour[];
};

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function getTourHref(tour: Pick<FeaturedTour, "id">): string {
  return `/tours/${encodeURIComponent(String(tour.id))}`;
}

export default function FeaturedToursSlice({ tours }: Props) {
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    if (tours.length <= 1) return;

    const timer = setInterval(() => {
      setStartIndex((prev) => (prev + 1) % tours.length);
    }, 4200);

    return () => clearInterval(timer);
  }, [tours.length]);

  const visibleTours = useMemo(() => {
    if (tours.length === 0) return [] as FeaturedTour[];

    return Array.from({ length: 3 }, (_, idx) => tours[(startIndex + idx) % tours.length]);
  }, [startIndex, tours]);

  if (!visibleTours.length) return null;

  return (
    <div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {visibleTours.map((item, idx) => (
          <article key={`${item.id}-${idx}-${startIndex}`} className="group relative isolate min-h-[340px] overflow-hidden rounded-[28px] border border-white/10 bg-[#11161d] shadow-[0_24px_56px_rgba(0,0,0,0.24)]">
            <img
              src={item.image}
              alt={item.title}
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(109,188,228,0.18),transparent_26%),linear-gradient(180deg,rgba(7,10,15,0.14)_0%,rgba(7,10,15,0.28)_24%,rgba(7,10,15,0.74)_68%,rgba(7,10,15,0.92)_100%)]" />
            <div className="relative z-10 flex h-full flex-col p-5">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[rgba(28,91,56,0.92)] px-3 py-1 text-xs font-black text-white shadow-lg shadow-black/10">
                  {item.categoryName || "Tour"}
                </span>
                <span className="rounded-full border border-white/12 bg-[rgba(37,44,57,0.82)] px-3 py-1 text-xs font-black text-white backdrop-blur-sm">
                  Private
                </span>
                {item.featured ? (
                  <span className="rounded-full border border-[var(--brand-gold)]/40 bg-[rgba(250,178,79,0.16)] px-3 py-1 text-xs font-black text-[var(--brand-gold)] backdrop-blur-sm">
                    Featured
                  </span>
                ) : null}
              </div>

              <div className="mt-auto">
                <h3 className="max-w-[18ch] text-[1.7rem] font-black leading-[1.05] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]">
                  {item.title}
                </h3>

                {item.location ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-200">
                    <MapPinIcon />
                    {item.location}
                  </p>
                ) : null}

                <p className="mt-2 line-clamp-2 max-w-[28ch] text-sm leading-relaxed text-slate-300/95">{item.description}</p>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <Link
                    href={getTourHref(item)}
                    className="rounded-full bg-[var(--brand-gold)] px-4 py-2.5 text-sm font-extrabold text-[#11151c] transition hover:brightness-105"
                  >
                    View tour
                  </Link>
                  {item.priceLabel ? (
                    <span className="text-3xl font-black text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]">{item.priceLabel}</span>
                  ) : (
                    <span className="rounded-full border border-white/12 bg-[rgba(22,26,34,0.72)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-200 backdrop-blur-sm">
                      Info only
                    </span>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {tours.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {tours.map((tour, idx) => (
            <button
              key={`dot-${tour.id}-${idx}`}
              type="button"
              onClick={() => setStartIndex(idx)}
              aria-label={`Show featured tours from ${idx + 1}`}
              className={`h-2.5 w-2.5 rounded-full transition ${startIndex === idx ? "bg-[var(--brand-gold)]" : "bg-white/25 hover:bg-white/55"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
