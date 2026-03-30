import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

// Slugify helper: quita tildes, ñ->n, minúsculas, solo letras/números/guiones
function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const tours = await prisma.tour.findMany();
  let updated = 0;
  for (const tour of tours) {
    const base = tour.title || `tour-${tour.id}`;
    let slug = slugify(base) || `tour-${tour.id}`;
    let suffix = 1;
    let uniqueSlug = slug;
    while (await prisma.tour.findFirst({ where: { slug: uniqueSlug, id: { not: tour.id } } })) {
      uniqueSlug = `${slug}-${suffix++}`;
    }

    if (tour.slug !== uniqueSlug) {
      await prisma.tour.update({ where: { id: tour.id }, data: { slug: uniqueSlug } });
      updated++;
    }
  }
  res.json({ updated });
}
