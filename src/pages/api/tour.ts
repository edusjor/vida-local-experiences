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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, slug } = req.query;
  let tour = null;

  try {
    if (typeof slug === 'string' && slug.length > 0) {
      // Resolve by slug without using Prisma `where.slug`, so this works even with a stale generated client.
      const tours = await prisma.tour.findMany({
        include: { category: true, availability: true },
      });
      tour =
        tours.find((item) => String((item as { slug?: unknown }).slug ?? '').trim() === slug) ||
        tours.find((item) => slugifyTourValue(String(item.title ?? '')) === slug) ||
        null;
    } else if (typeof id === 'string' && id.length > 0) {
      const parsedId = Number(id);
      if (Number.isFinite(parsedId)) {
        tour = await prisma.tour.findUnique({
          where: { id: parsedId },
          include: { category: true, availability: true },
        });
      }
    }
  } catch {
    return res.status(500).json({ error: 'Error consultando el tour.' });
  }

  if (!tour) return res.status(404).json({ error: "Tour no encontrado" });
  res.status(200).json(tour);
}
