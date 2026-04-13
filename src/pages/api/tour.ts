import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

function slugifyTourValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

type TourWithOptionalAvailabilityConfig = {
  id: number;
  availabilityConfig?: unknown;
};

async function hydrateAvailabilityConfigIfMissing(tour: TourWithOptionalAvailabilityConfig | null): Promise<TourWithOptionalAvailabilityConfig | null> {
  if (!tour) return null;
  if (tour.availabilityConfig !== undefined && tour.availabilityConfig !== null) return tour;

  try {
    const rows = await prisma.$queryRaw<Array<{ availabilityConfig: unknown }>>`
      SELECT "availabilityConfig"
      FROM "Tour"
      WHERE "id" = ${tour.id}
      LIMIT 1
    `;

    if (!rows[0]) return tour;
    return {
      ...tour,
      availabilityConfig: rows[0].availabilityConfig,
    };
  } catch {
    return tour;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, slug } = req.query;
  let tour: TourWithOptionalAvailabilityConfig | null = null;

  try {
    if (typeof slug === 'string' && slug.length > 0) {
      // Resolve fast path by slug via SQL to avoid stale Prisma client type issues.
      const directRows = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "Tour"
        WHERE "slug" = ${slug}
        LIMIT 1
      `;

      let targetId: number | null = directRows[0]?.id ?? null;

      // Backward-compatible fallback for legacy routes where slug came from title.
      if (!targetId) {
        const titleCandidates = await prisma.tour.findMany({
          select: { id: true, title: true },
        });

        targetId =
          titleCandidates.find((item) => slugifyTourValue(String(item.title ?? '')) === slug)?.id ?? null;
      }

      if (targetId !== null) {
        tour = await prisma.tour.findUnique({
          where: { id: targetId },
          include: { category: true, availability: true },
        });
      }
    } else if (typeof id === 'string' && id.length > 0) {
      const parsedId = Number(id);
      if (Number.isFinite(parsedId)) {
        tour = await prisma.tour.findUnique({
          where: { id: parsedId },
          include: { category: true, availability: true },
        });
      }
    }

    tour = await hydrateAvailabilityConfigIfMissing(tour);
  } catch {
    return res.status(500).json({ error: 'Error consultando el tour.' });
  }

  if (!tour) return res.status(404).json({ error: 'Tour no encontrado' });
  res.status(200).json(tour);
}
