import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { getOnvoPaymentIntent } from '../../lib/onvo';
import nodemailer from 'nodemailer';

type AvailabilityConfig = {
  mode: 'SPECIFIC' | 'OPEN';
  openSchedule: {
    maxPeople: number;
  };
};

function normalizeAvailabilityConfig(input: unknown): AvailabilityConfig {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const openSource = source.openSchedule && typeof source.openSchedule === 'object'
    ? (source.openSchedule as Record<string, unknown>)
    : {};

  return {
    mode: source.mode === 'OPEN' ? 'OPEN' : 'SPECIFIC',
    openSchedule: {
      maxPeople: Number.isFinite(Number(openSource.maxPeople)) && Number(openSource.maxPeople) > 0 ? Math.floor(Number(openSource.maxPeople)) : 10,
    },
  };
}

function toDateRange(date: Date): { start: Date; end: Date } {
  const isoDate = date.toISOString().slice(0, 10);
  return {
    start: new Date(`${isoDate}T00:00:00.000Z`),
    end: new Date(`${isoDate}T23:59:59.999Z`),
  };
}

function formatDateEs(date: Date): string {
  return new Intl.DateTimeFormat('es-CR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function sendReservationConfirmationEmail(input: {
  reservationId: number;
  customerEmail: string;
  customerName: string;
  tourTitle: string;
  people: number;
  date: Date;
  scheduleTime: string | null;
}): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;
  const notifyTo = process.env.RESERVATION_TO_EMAIL || process.env.CONTACT_TO_EMAIL || '';

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom || !Number.isFinite(smtpPort)) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const dateText = formatDateEs(input.date);
  const timeText = input.scheduleTime?.trim() || 'Por coordinar';
  const subject = `Reserva confirmada #${input.reservationId} - ${input.tourTitle}`;
  const text = [
    `Hola ${input.customerName},`,
    '',
    'Tu pago fue aprobado y tu reserva quedo confirmada.',
    '',
    `Reserva: #${input.reservationId}`,
    `Tour: ${input.tourTitle}`,
    `Fecha: ${dateText}`,
    `Horario: ${timeText}`,
    `Personas: ${input.people}`,
    '',
    'Gracias por reservar con nosotros.',
  ].join('\n');

  const html = `
    <h2>Reserva confirmada</h2>
    <p>Hola <strong>${input.customerName}</strong>,</p>
    <p>Tu pago fue aprobado y tu reserva quedo confirmada.</p>
    <ul>
      <li><strong>Reserva:</strong> #${input.reservationId}</li>
      <li><strong>Tour:</strong> ${input.tourTitle}</li>
      <li><strong>Fecha:</strong> ${dateText}</li>
      <li><strong>Horario:</strong> ${timeText}</li>
      <li><strong>Personas:</strong> ${input.people}</li>
    </ul>
    <p>Gracias por reservar con nosotros.</p>
  `;

  const recipients = [input.customerEmail, notifyTo].filter((item) => Boolean(item));
  await transporter.sendMail({
    from: smtpFrom,
    to: recipients,
    subject,
    text,
    html,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const reservationId = Number(req.body?.reservationId);
  const paymentIntentId = String(req.body?.paymentIntentId ?? '').trim();

  if (!Number.isFinite(reservationId) || reservationId <= 0 || !paymentIntentId) {
    return res.status(400).json({ error: 'Datos de confirmacion invalidos' });
  }

  try {
    const paymentIntent = await getOnvoPaymentIntent(paymentIntentId);
    const normalizedPaymentStatus = String(paymentIntent.status ?? '').toLowerCase();
    const approvedStatuses = new Set(['succeeded', 'paid', 'approved']);

    if (!approvedStatuses.has(normalizedPaymentStatus)) {
      return res.status(202).json({
        pending: true,
        status: paymentIntent.status,
        message: 'Pago recibido, en espera de confirmacion final.',
      });
    }

    if (String(paymentIntent.metadata?.reservationId ?? '') !== String(reservationId)) {
      return res.status(400).json({ error: 'El pago no coincide con la reserva indicada' });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
        });

        if (!reservation) {
          return { ok: false as const, status: 404, error: 'Reserva no encontrada' };
        }

        if (reservation.paid) {
          const tourForEmail = await tx.tour.findUnique({
            where: { id: reservation.tourId },
            select: { title: true },
          });
          return {
            ok: true as const,
            alreadyPaid: true,
            emailData: {
              reservationId: reservation.id,
              customerEmail: reservation.email,
              customerName: [reservation.name, reservation.lastName].filter(Boolean).join(' ').trim() || reservation.name,
              tourTitle: tourForEmail?.title || 'Tour',
              people: reservation.people,
              date: reservation.date,
              scheduleTime: reservation.scheduleTime,
            },
          };
        }

        const tour = await tx.tour.findUnique({
          where: { id: reservation.tourId },
          select: { id: true, availabilityConfig: true },
        });

        if (!tour) {
          return { ok: false as const, status: 404, error: 'Tour no encontrado' };
        }

        const dateRange = toDateRange(reservation.date);
        const specificAvailability = await tx.availability.findFirst({
          where: {
            tourId: reservation.tourId,
            date: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
          select: { maxPeople: true },
        });

        const availabilityConfig = normalizeAvailabilityConfig(tour.availabilityConfig);
        const maxPeople = specificAvailability?.maxPeople ?? (availabilityConfig.mode === 'OPEN' ? availabilityConfig.openSchedule.maxPeople : 0);
        if (maxPeople <= 0) {
          return { ok: false as const, status: 409, error: 'No hay cupos disponibles para confirmar esta reserva' };
        }

        const grouped = await tx.reservation.groupBy({
          by: ['tourId', 'date'],
          where: {
            tourId: reservation.tourId,
            date: reservation.date,
            paid: true,
          },
          _sum: { people: true },
        });

        const reservedPeople = grouped[0]?._sum.people ?? 0;
        const remaining = maxPeople - reservedPeople;

        if (reservation.people > remaining) {
          return { ok: false as const, status: 409, error: 'Ya no hay cupos disponibles para confirmar este pago' };
        }

        const updatedReservation = await tx.reservation.update({
          where: { id: reservation.id },
          data: { paid: true },
        });

        const tourForEmail = await tx.tour.findUnique({
          where: { id: reservation.tourId },
          select: { title: true },
        });

        return {
          ok: true as const,
          alreadyPaid: false,
          emailData: {
            reservationId: updatedReservation.id,
            customerEmail: updatedReservation.email,
            customerName: [updatedReservation.name, updatedReservation.lastName].filter(Boolean).join(' ').trim() || updatedReservation.name,
            tourTitle: tourForEmail?.title || 'Tour',
            people: updatedReservation.people,
            date: updatedReservation.date,
            scheduleTime: updatedReservation.scheduleTime,
          },
        };
      },
      {
        isolationLevel: 'Serializable',
      },
    );

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.ok && result.emailData) {
      await sendReservationConfirmationEmail(result.emailData).catch(() => null);
    }

    return res.status(200).json({
      ok: true,
      message: result.alreadyPaid
        ? 'La reserva ya estaba confirmada previamente.'
        : 'Pago validado y reserva confirmada.',
    });
  } catch {
    return res.status(500).json({ error: 'No se pudo confirmar el estado del pago' });
  }
}
