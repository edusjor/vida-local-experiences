import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const {
    tourId,
    availabilityId,
    people,
    adults,
    kids,
    name,
    lastName,
    email,
    emailConfirm,
    phone,
    hotel,
    paymentMethod,
    promoCode,
    scheduleTime,
  } = req.body;

  const parsedTourId = Number(tourId);
  const parsedAvailabilityId = Number(availabilityId);
  const parsedPeople = Number(people);
  const parsedAdults = Number.isFinite(Number(adults)) ? Number(adults) : null;
  const parsedKids = Number.isFinite(Number(kids)) ? Number(kids) : null;

  if (!Number.isFinite(parsedTourId) || !Number.isFinite(parsedAvailabilityId) || !Number.isFinite(parsedPeople) || parsedPeople <= 0) {
    return res.status(400).json({ error: 'Datos de reserva invalidos' });
  }

  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
  }

  if (typeof email === 'string' && typeof emailConfirm === 'string' && emailConfirm.trim() && email.trim() !== emailConfirm.trim()) {
    return res.status(400).json({ error: 'El correo y su confirmacion no coinciden' });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const tour = await tx.tour.findUnique({
          where: { id: parsedTourId },
          select: { id: true, minPeople: true },
        });
        if (!tour) {
          return { ok: false as const, error: 'Tour no encontrado' };
        }

        const minimumPeople = Math.max(1, Number(tour.minPeople ?? 1));
        if (parsedPeople < minimumPeople) {
          return {
            ok: false as const,
            error: `Debes reservar minimo ${minimumPeople} persona${minimumPeople === 1 ? '' : 's'}.`,
          };
        }

        const av = await tx.availability.findUnique({ where: { id: parsedAvailabilityId } });
        if (!av) {
          return { ok: false as const, error: 'No hay disponibilidad' };
        }

        if (av.tourId !== parsedTourId) {
          return { ok: false as const, error: 'La disponibilidad seleccionada no pertenece al tour indicado' };
        }

        const grouped = await tx.reservation.groupBy({
          by: ['tourId', 'date'],
          where: {
            tourId: parsedTourId,
            date: av.date,
          },
          _sum: { people: true },
        });

        const reservedPeople = grouped[0]?._sum.people ?? 0;
        const remaining = av.maxPeople - reservedPeople;

        if (parsedPeople > remaining) {
          return {
            ok: false as const,
            error: remaining > 0 ? `No hay disponibilidad suficiente. Cupos restantes: ${remaining}` : 'No hay disponibilidad',
          };
        }

        await tx.reservation.create({
          data: {
            tourId: parsedTourId,
            people: parsedPeople,
            adults: parsedAdults,
            kids: parsedKids,
            date: av.date,
            name,
            lastName,
            email,
            emailConfirm,
            phone,
            hotel,
            paymentMethod,
            promoCode,
            scheduleTime,
            paid: true,
          },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: 'Serializable',
      },
    );

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'No se pudo completar la reserva' });
  }
}
