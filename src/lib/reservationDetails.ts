import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type PriceBreakdownItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type ReservationCheckoutDetails = {
  packageTitle: string | null;
  priceBreakdown: PriceBreakdownItem[];
  totalAmount: number | null;
};

let schemaEnsured = false;

async function ensureReservationDetailColumns(): Promise<void> {
  if (schemaEnsured) return;

  await prisma.$executeRawUnsafe('ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "packageTitle" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "priceBreakdown" JSONB');
  await prisma.$executeRawUnsafe('ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "totalAmount" DOUBLE PRECISION');
  schemaEnsured = true;
}

function normalizePriceBreakdown(input: unknown): PriceBreakdownItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const source = item as {
        id?: unknown;
        name?: unknown;
        quantity?: unknown;
        unitPrice?: unknown;
        totalPrice?: unknown;
      };

      const id = String(source.id ?? '').trim();
      const name = String(source.name ?? '').trim();
      const quantity = Number(source.quantity);
      const unitPrice = Number(source.unitPrice);
      const totalPrice = Number(source.totalPrice);

      return {
        id,
        name,
        quantity,
        unitPrice,
        totalPrice,
      } satisfies PriceBreakdownItem;
    })
    .filter((item) => item.id && item.name && Number.isFinite(item.quantity) && item.quantity > 0);
}

export async function saveReservationCheckoutDetails(input: {
  reservationId: number;
  packageTitle: string | null;
  priceBreakdown: PriceBreakdownItem[];
  totalAmount: number;
}): Promise<void> {
  await ensureReservationDetailColumns();

  const reservationId = Number(input.reservationId);
  if (!Number.isFinite(reservationId) || reservationId <= 0) return;

  await prisma.$executeRaw`
    UPDATE "Reservation"
    SET
      "packageTitle" = ${input.packageTitle ? String(input.packageTitle).trim() : null},
      "priceBreakdown" = ${JSON.stringify(input.priceBreakdown)}::jsonb,
      "totalAmount" = ${Number.isFinite(input.totalAmount) ? input.totalAmount : null}
    WHERE "id" = ${reservationId}
  `;
}

export async function getReservationCheckoutDetailsByIds(reservationIds: number[]): Promise<Map<number, ReservationCheckoutDetails>> {
  await ensureReservationDetailColumns();

  const safeIds = reservationIds.filter((item) => Number.isFinite(item) && item > 0);
  if (safeIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<Array<{
    id: number;
    packageTitle: string | null;
    priceBreakdown: unknown;
    totalAmount: number | null;
  }>>`
    SELECT "id", "packageTitle", "priceBreakdown", "totalAmount"
    FROM "Reservation"
    WHERE "id" IN (${Prisma.join(safeIds)})
  `;

  const map = new Map<number, ReservationCheckoutDetails>();
  rows.forEach((row) => {
    const breakdown = normalizePriceBreakdown(row.priceBreakdown);
    const rawTotal = Number(row.totalAmount);
    const fallbackFromBreakdown = breakdown.reduce((acc, item) => acc + (Number.isFinite(item.totalPrice) ? item.totalPrice : 0), 0);

    map.set(row.id, {
      packageTitle: row.packageTitle ? String(row.packageTitle).trim() : null,
      priceBreakdown: breakdown,
      totalAmount: Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : (fallbackFromBreakdown > 0 ? fallbackFromBreakdown : null),
    });
  });

  return map;
}

export async function getReservationCheckoutDetailsById(reservationId: number): Promise<ReservationCheckoutDetails> {
  const map = await getReservationCheckoutDetailsByIds([reservationId]);
  return map.get(reservationId) || { packageTitle: null, priceBreakdown: [], totalAmount: null };
}
