import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminSession } from '../../../lib/adminAuth';
import { prisma } from '../../../lib/prisma';

function getCategoryId(req: NextApiRequest): number {
  const bodyId = Number(req.body?.id);
  if (Number.isFinite(bodyId)) return bodyId;

  const queryId = Number(req.query?.id);
  if (Number.isFinite(queryId)) return queryId;

  return Number.NaN;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).end();
  }

  if (!requireAdminSession(req, res)) return;

  try {
    if (req.method === 'POST') {
      const name = String(req.body?.name ?? '').trim();
      if (!name) {
        return res.status(400).json({ error: 'El nombre de categoria es obligatorio' });
      }

      const created = await prisma.category.create({ data: { name } });
      return res.status(200).json(created);
    }

    const id = getCategoryId(req);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID de categoria invalido' });
    }

    if (req.method === 'PUT') {
      const name = String(req.body?.name ?? '').trim();
      if (!name) {
        return res.status(400).json({ error: 'El nombre de categoria es obligatorio' });
      }

      const updated = await prisma.category.update({
        where: { id },
        data: { name },
      });

      return res.status(200).json(updated);
    }

    const usedByTours = await prisma.tour.count({ where: { categoryId: id } });
    if (usedByTours > 0) {
      return res.status(400).json({ error: 'No puedes eliminar una categoria usada por tours existentes.' });
    }

    await prisma.category.delete({ where: { id } });
    return res.status(200).json({ ok: true, deletedId: id });
  } catch {
    return res.status(500).json({ error: 'No se pudo procesar la categoria en la base de datos.' });
  }
}
