import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const tour = await prisma.tour.findUnique({
    where: { id: Number(id) },
    include: { category: true, availability: true },
  });
  res.status(200).json(tour);
}
