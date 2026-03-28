import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { tourId } = req.query;
  const availability = await prisma.availability.findMany({
    where: { tourId: Number(tourId) },
  });
  res.status(200).json(availability);
}
