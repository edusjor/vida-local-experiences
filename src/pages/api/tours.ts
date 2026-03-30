import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tours = await prisma.tour.findMany({
    include: { category: true, availability: true },
  });
  // Prisma ya incluye slug, pero si algún tour no lo tiene, lo forzamos a string vacío para evitar undefined
  const toursWithSlug = tours.map(t => ({ ...t, slug: t.slug || "" }));
  res.status(200).json(toursWithSlug);
}
