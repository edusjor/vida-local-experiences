import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, slug } = req.query;
  let tour = null;
  if (typeof slug === "string" && slug.length > 0) {
    tour = await prisma.tour.findUnique({
      where: { slug },
      include: { category: true, availability: true },
    });
  } else if (typeof id === "string" && id.length > 0) {
    tour = await prisma.tour.findUnique({
      where: { id: Number(id) },
      include: { category: true, availability: true },
    });
  }
  if (!tour) return res.status(404).json({ error: "Tour no encontrado" });
  res.status(200).json(tour);
}
