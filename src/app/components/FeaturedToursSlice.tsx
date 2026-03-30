"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FeaturedTour = {
  id: number;
  title: string;
  image: string;
  description: string;
  categoryName: string;
  priceLabel: string;
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

  useEffect(() => {
    setStartIndex(0);
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
          <article key={`${item.id}-${idx}-${startIndex}`} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-300/40">
            <div className="relative">
              <img src={item.image} alt={item.title} className="h-44 w-full object-cover" />
              {item.featured && (
                <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-900">Destacado</span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">{item.categoryName || "Tour"}</p>
              <h3 className="mt-1 line-clamp-3 min-h-[6.25rem] text-2xl font-extrabold leading-tight text-slate-900">{item.title}</h3>
              <p className="mt-2 line-clamp-3 whitespace-pre-line text-slate-600">{item.description}</p>

              <div className="mt-3 min-h-10">
                {item.location && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <MapPinIcon />
                    {item.location}
                  </span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <span className="text-3xl font-black text-emerald-600">{item.priceLabel}</span>
              <Link
                href={getTourHref(item)}
                className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-amber-300"
              >
                Ver detalles
              </Link>
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
              aria-label={`Mostrar destacados desde ${idx + 1}`}
              className={`h-2.5 w-2.5 rounded-full transition ${startIndex === idx ? "bg-amber-300" : "bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
