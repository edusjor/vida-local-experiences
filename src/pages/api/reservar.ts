import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

type AvailabilityConfig = {
  mode: 'SPECIFIC' | 'OPEN';
  openSchedule: {
    maxPeople: number;
    startTime: string;
    endTime: string;
    intervalMinutes: number;
    useCustomTimes: boolean;
    customTimesText: string;
  };
  dateSchedules: Record<string, string[]>;
};

function normalizeTime24(value: unknown): string | null {
  const trimmed = String(value ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeTimeSlots(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items
        .map((item) => normalizeTime24(item))
        .filter((item): item is string => Boolean(item)),
    ),
  ).sort();
}

function parseCustomTimeSlots(input: string): string[] {
  return Array.from(
    new Set(
      String(input || '')
        .split(/[\n,;]+/)
        .map((item) => normalizeTime24(item))
        .filter((item): item is string => Boolean(item)),
    ),
  ).sort();
}

function toMinutes(time24: string): number {
  const [hours, minutes] = time24.split(':').map(Number);
  return hours * 60 + minutes;
}

function buildIntervalTimeSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
  const start = normalizeTime24(startTime);
  const end = normalizeTime24(endTime);
  if (!start || !end) return [];

  const safeInterval = Number.isFinite(intervalMinutes) ? Math.floor(intervalMinutes) : 0;
  if (safeInterval <= 0) return [];

  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin > endMin) return [];

  const slots: string[] = [];
  for (let min = startMin; min <= endMin; min += safeInterval) {
    const hours = Math.floor(min / 60);
    const minutes = min % 60;
    slots.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  }

  return slots;
}

function normalizeAvailabilityConfig(input: unknown): AvailabilityConfig {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const openSource = source.openSchedule && typeof source.openSchedule === 'object'
    ? (source.openSchedule as Record<string, unknown>)
    : {};
  const dateSchedulesRaw = source.dateSchedules && typeof source.dateSchedules === 'object' && !Array.isArray(source.dateSchedules)
    ? (source.dateSchedules as Record<string, unknown>)
    : {};

  const dateSchedules: Record<string, string[]> = {};
  Object.entries(dateSchedulesRaw).forEach(([key, value]) => {
    dateSchedules[key] = normalizeTimeSlots(value);
  });

  return {
    mode: source.mode === 'OPEN' ? 'OPEN' : 'SPECIFIC',
    openSchedule: {
      maxPeople: Number.isFinite(Number(openSource.maxPeople)) && Number(openSource.maxPeople) > 0 ? Math.floor(Number(openSource.maxPeople)) : 10,
      startTime: normalizeTime24(openSource.startTime) ?? '08:00',
      endTime: normalizeTime24(openSource.endTime) ?? '17:00',
      intervalMinutes:
        Number.isFinite(Number(openSource.intervalMinutes)) && Number(openSource.intervalMinutes) > 0
          ? Math.floor(Number(openSource.intervalMinutes))
          : 30,
      useCustomTimes: Boolean(openSource.useCustomTimes),
      customTimesText: String(openSource.customTimesText ?? ''),
    },
    dateSchedules,
  };
}

function buildOpenScheduleSlots(config: AvailabilityConfig): string[] {
  if (config.openSchedule.useCustomTimes) {
    return parseCustomTimeSlots(config.openSchedule.customTimesText);
  }
  return buildIntervalTimeSlots(config.openSchedule.startTime, config.openSchedule.endTime, config.openSchedule.intervalMinutes);
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateKeyInput(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const simple = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (simple) return `${simple[1]}-${simple[2]}-${simple[3]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const {
    tourId,
    availabilityId,
    selectedDate,
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
  const selectedDateKey = normalizeDateKeyInput(selectedDate);
  const parsedPeople = Number(people);
  const parsedAdults = Number.isFinite(Number(adults)) ? Number(adults) : null;
  const parsedKids = Number.isFinite(Number(kids)) ? Number(kids) : null;

  if (!Number.isFinite(parsedTourId) || !Number.isFinite(parsedPeople) || parsedPeople <= 0) {
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
          select: { id: true, minPeople: true, availabilityConfig: true },
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

        const availabilityConfig = normalizeAvailabilityConfig(tour.availabilityConfig);

        let targetDate: Date | null = null;
        let maxPeople = 0;
        let allowedTimes: string[] = [];

        const hasAvailabilityId = Number.isFinite(parsedAvailabilityId) && parsedAvailabilityId > 0;
        if (hasAvailabilityId) {
          const av = await tx.availability.findUnique({ where: { id: parsedAvailabilityId } });
          if (!av) {
            return { ok: false as const, error: 'No hay disponibilidad' };
          }

          if (av.tourId !== parsedTourId) {
            return { ok: false as const, error: 'La disponibilidad seleccionada no pertenece al tour indicado' };
          }

          targetDate = av.date;
          maxPeople = av.maxPeople;
          const key = toDateKey(av.date);
          allowedTimes = normalizeTimeSlots(availabilityConfig.dateSchedules[key]);
          if (allowedTimes.length === 0 && availabilityConfig.mode === 'OPEN') {
            allowedTimes = buildOpenScheduleSlots(availabilityConfig);
          }
        } else {
          if (!selectedDateKey) {
            return { ok: false as const, error: 'Debes seleccionar una fecha valida' };
          }

          const dateStart = new Date(`${selectedDateKey}T00:00:00.000Z`);
          const dateEnd = new Date(`${selectedDateKey}T23:59:59.999Z`);
          const specificDateAvailability = await tx.availability.findFirst({
            where: {
              tourId: parsedTourId,
              date: {
                gte: dateStart,
                lte: dateEnd,
              },
            },
          });

          if (specificDateAvailability) {
            targetDate = specificDateAvailability.date;
            maxPeople = specificDateAvailability.maxPeople;
            allowedTimes = normalizeTimeSlots(availabilityConfig.dateSchedules[selectedDateKey]);
          } else if (availabilityConfig.mode === 'OPEN') {
            targetDate = new Date(`${selectedDateKey}T09:00:00.000Z`);
            maxPeople = availabilityConfig.openSchedule.maxPeople;
            allowedTimes = buildOpenScheduleSlots(availabilityConfig);
          } else {
            return { ok: false as const, error: 'No hay disponibilidad para la fecha seleccionada' };
          }
        }

        if (!targetDate || maxPeople <= 0) {
          return { ok: false as const, error: 'No hay disponibilidad' };
        }

        const scheduleTimeNormalized = normalizeTime24(scheduleTime);
        if (allowedTimes.length > 0 && (!scheduleTimeNormalized || !allowedTimes.includes(scheduleTimeNormalized))) {
          return { ok: false as const, error: 'El horario seleccionado no esta disponible para esa fecha' };
        }

        const grouped = await tx.reservation.groupBy({
          by: ['tourId', 'date'],
          where: {
            tourId: parsedTourId,
            date: targetDate,
          },
          _sum: { people: true },
        });

        const reservedPeople = grouped[0]?._sum.people ?? 0;
        const remaining = maxPeople - reservedPeople;

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
            date: targetDate,
            name,
            lastName,
            email,
            emailConfirm,
            phone,
            hotel,
            paymentMethod,
            promoCode,
            scheduleTime: scheduleTimeNormalized || scheduleTime,
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
