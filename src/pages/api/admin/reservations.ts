import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { requireAdminSession } from '../../../lib/adminAuth';
import { sendReservationConfirmationEmailByReservationId } from '../../../lib/reservationPayment';
import { getReservationCheckoutDetailsByIds } from '../../../lib/reservationDetails';

type SortBy = 'createdAt' | 'date';
type SortOrder = 'asc' | 'desc';
type PaymentFilter = 'all' | 'card' | 'sinpe';
type StatusFilter = 'all' | 'pending' | 'paid';

function normalizeSortBy(value: unknown): SortBy {
  return String(value ?? '').trim() === 'date' ? 'date' : 'createdAt';
}

function normalizeSortOrder(value: unknown): SortOrder {
  return String(value ?? '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizePaymentFilter(value: unknown): PaymentFilter {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'card') return 'card';
  if (normalized === 'sinpe') return 'sinpe';
  return 'all';
}

function normalizeStatusFilter(value: unknown): StatusFilter {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'pending') return 'pending';
  if (normalized === 'paid') return 'paid';
  return 'all';
}

const SINPE_PAYMENT_METHOD = 'SINPE Movil';

function getWhereForList(input: { paymentFilter: PaymentFilter; statusFilter: StatusFilter }) {
  const { paymentFilter, statusFilter } = input;

  if (paymentFilter === 'card') {
    return {
      paid: true,
      NOT: {
        paymentMethod: SINPE_PAYMENT_METHOD,
      },
    };
  }

  if (paymentFilter === 'sinpe') {
    if (statusFilter === 'pending') {
      return {
        paymentMethod: SINPE_PAYMENT_METHOD,
        paid: false,
      };
    }

    if (statusFilter === 'paid') {
      return {
        paymentMethod: SINPE_PAYMENT_METHOD,
        paid: true,
      };
    }

    return {
      paymentMethod: SINPE_PAYMENT_METHOD,
    };
  }

  if (statusFilter === 'pending') {
    return {
      paymentMethod: SINPE_PAYMENT_METHOD,
      paid: false,
    };
  }

  if (statusFilter === 'paid') {
    return {
      paid: true,
    };
  }

  return {
    OR: [
      { paid: true },
      { paymentMethod: SINPE_PAYMENT_METHOD },
    ],
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminSession(req, res)) return;

  if (req.method === 'PATCH') {
    const reservationId = Number(req.body?.reservationId);
    const desiredStatus = String(req.body?.status ?? '').trim().toLowerCase();

    if (!Number.isFinite(reservationId) || reservationId <= 0) {
      return res.status(400).json({ error: 'Id de reserva invalido' });
    }

    if (desiredStatus !== 'paid' && desiredStatus !== 'pending') {
      return res.status(400).json({ error: 'Estado invalido. Usa pending o paid.' });
    }

    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { id: true, paymentMethod: true, paid: true },
      });

      if (!reservation) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      if (String(reservation.paymentMethod ?? '') !== SINPE_PAYMENT_METHOD) {
        return res.status(400).json({ error: 'Solo las reservas SINPE se gestionan manualmente en este modulo.' });
      }

      const nextPaid = desiredStatus === 'paid';
      if (reservation.paid === nextPaid) {
        return res.status(200).json({ ok: true, reservationId, paid: reservation.paid });
      }

      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { paid: nextPaid },
        select: { id: true, paid: true },
      });

      if (nextPaid) {
        await sendReservationConfirmationEmailByReservationId(updated.id).catch(() => null);
      }

      return res.status(200).json({ ok: true, reservationId: updated.id, paid: updated.paid });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      return res.status(500).json({ error: 'No se pudo actualizar el estado de la reserva.', detail });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const sortBy = normalizeSortBy(req.query.sortBy);
  const order = normalizeSortOrder(req.query.order);
  const paymentFilter = normalizePaymentFilter(req.query.payment);
  const statusFilter = normalizeStatusFilter(req.query.status);

  try {
    const orderBy = sortBy === 'createdAt' ? { id: order } : { date: order };
    const where = getWhereForList({ paymentFilter, statusFilter });

    const reservations = await prisma.reservation.findMany({
      orderBy,
      where,
      include: {
        tour: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const normalizedReservations = reservations.map((reservation) => {
      const entry = reservation as Record<string, unknown>;
      const createdAt =
        typeof entry.createdAt === 'string'
          ? entry.createdAt
          : entry.createdAt instanceof Date
            ? entry.createdAt.toISOString()
            : reservation.date.toISOString();

      return {
        ...reservation,
        createdAt,
        sinpeReceiptUrl: typeof entry.sinpeReceiptUrl === 'string' ? entry.sinpeReceiptUrl : null,
      };
    });

    const detailsByReservationId = await getReservationCheckoutDetailsByIds(normalizedReservations.map((item) => item.id)).catch(() => new Map());
    const reservationsWithDetails = normalizedReservations.map((item) => {
      const details = detailsByReservationId.get(item.id);
      return {
        ...item,
        packageTitle: details?.packageTitle || null,
        priceBreakdown: details?.priceBreakdown || [],
        totalAmount: Number.isFinite(Number(details?.totalAmount)) ? Number(details?.totalAmount) : null,
      };
    });

    return res.status(200).json({ reservations: reservationsWithDetails, sortBy, order, paymentFilter, statusFilter });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: 'No se pudieron cargar las reservas.', detail });
  }
}
