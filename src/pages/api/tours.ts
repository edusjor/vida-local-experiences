import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tours = await prisma.tour.findMany({
    include: { category: true, availability: true },
  });
  res.status(200).json(tours);
}
