import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminSession } from '../../../lib/adminAuth';
import { prisma } from '../../../lib/prisma';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const validStatuses = ['ACTIVO', 'NO_ACTIVO', 'BORRADOR'] as const;
type ValidStatus = (typeof validStatuses)[number];

function toValidStatus(value: unknown): ValidStatus | null {
  if (typeof value !== 'string') return null;
  return validStatuses.includes(value as ValidStatus) ? (value as ValidStatus) : null;
}

function getTourId(req: NextApiRequest): number {
  const bodyId = Number(req.body?.id);
  if (Number.isFinite(bodyId)) return bodyId;

  const queryId = Number(req.query?.id);
  if (Number.isFinite(queryId)) return queryId;

  return Number.NaN;
}

function isUnknownArgumentError(error: unknown, argumentName: string): boolean {
  if (!(error instanceof Error)) return false;
  const message = String(error.message || '');
  return message.includes(`Unknown argument \`${argumentName}\``);
}

function stripUnsupportedTourFields(
  data: Record<string, unknown>,
  unsupportedFields: string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !unsupportedFields.includes(key)),
  );
}

type NormalizedPriceOption = {
  id: string;
  name: string;
  isFree: boolean;
  isBase: boolean;
  price: number;
};

type NormalizedTourPackage = {
  id: string;
  title: string;
  description: string;
  priceOptions: NormalizedPriceOption[];
};

function normalizePriceOptionsInput(items: unknown): NormalizedPriceOption[] {
  if (!Array.isArray(items)) return [];

  const normalized = items
    .map((item, index) => {
      const source = item as { id?: unknown; name?: unknown; price?: unknown; isFree?: unknown; isBase?: unknown };
      const id = String(source?.id ?? `price-${index}`).trim();
      const name = String(source?.name ?? '').trim();
      const isFree = Boolean(source?.isFree);
      const isBase = Boolean(source?.isBase);
      const parsedPrice = Number(source?.price);
      const price = isFree ? 0 : parsedPrice;

      return {
        id,
        name,
        isFree,
        isBase,
        price,
      };
    })
    .filter((item) => item.id && item.name && (item.isFree || (Number.isFinite(item.price) && item.price > 0)));

  if (!normalized.length) return [];

  const baseIndex = normalized.findIndex((item) => item.isBase);
  const normalizedBaseIndex = baseIndex === -1 ? 0 : baseIndex;

  return normalized.map((item, index) => ({
    ...item,
    isBase: index === normalizedBaseIndex,
  }));
}

function normalizeTourPackagesInput(items: unknown): NormalizedTourPackage[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, pkgIndex) => {
      const source = item as { id?: unknown; title?: unknown; description?: unknown; priceOptions?: unknown };
      const id = String(source?.id ?? `package-${pkgIndex}`).trim() || `package-${pkgIndex}`;
      const title = String(source?.title ?? '').trim();
      const description = String(source?.description ?? '').trim();
      const priceOptions = normalizePriceOptionsInput(source?.priceOptions);

      return {
        id,
        title,
        description,
        priceOptions,
      };
    })
    .filter((pkg) => pkg.title && pkg.priceOptions.length > 0);
}

function getPrimaryTourPriceFromPackages(items: NormalizedTourPackage[], fallbackPrice: number): number {
  const firstPackage = items[0];
  if (!firstPackage || !firstPackage.priceOptions.length) return fallbackPrice;
  const baseOption = firstPackage.priceOptions.find((option) => option.isBase) || firstPackage.priceOptions[0];
  if (!baseOption) return fallbackPrice;
  return baseOption.isFree ? 0 : baseOption.price;
}

async function resolveCategoryId(
  db: {
    category: {
      findUnique: (args: { where: { id: number } }) => Promise<{ id: number } | null>;
      upsert: (args: {
        where: { name: string };
        update: Record<string, never>;
        create: { name: string };
      }) => Promise<{ id: number }>;
    };
  },
  candidateCategoryId: number,
): Promise<number> {
  if (Number.isFinite(candidateCategoryId) && candidateCategoryId > 0) {
    const existing = await db.category.findUnique({ where: { id: candidateCategoryId } });
    if (existing) return existing.id;
  }

  const fallbackCategory = await db.category.upsert({
    where: { name: 'Sin categoria' },
    update: {},
    create: { name: 'Sin categoria' },
  });

  return fallbackCategory.id;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).end();
  }

  if (!requireAdminSession(req, res)) return;

  const { title, description, price, images, categoryId, status, availability } = req.body;
  const parsedCategoryId = Number(categoryId);
  const minPeopleValue = Number(req.body?.minPeople);
  const minPeople = Number.isFinite(minPeopleValue) && minPeopleValue >= 1 ? Math.floor(minPeopleValue) : 1;

  const country = typeof req.body?.country === 'string' && req.body.country.trim() ? req.body.country.trim() : null;
  const zone = typeof req.body?.zone === 'string' && req.body.zone.trim() ? req.body.zone.trim() : null;
  const durationDays = Number.isFinite(Number(req.body?.durationDays)) ? Number(req.body.durationDays) : null;
  const durationHours = Number.isFinite(Number(req.body?.durationHours)) ? Number(req.body.durationHours) : null;
  const activityType = typeof req.body?.activityType === 'string' && req.body.activityType.trim() ? req.body.activityType.trim() : null;
  const difficulty = typeof req.body?.difficulty === 'string' && req.body.difficulty.trim() ? req.body.difficulty.trim() : null;
  const rating = Number.isFinite(Number(req.body?.rating)) ? Number(req.body.rating) : null;
  const reviews = Number.isFinite(Number(req.body?.reviews)) ? Number(req.body.reviews) : null;
  const guideType = typeof req.body?.guideType === 'string' && req.body.guideType.trim() ? req.body.guideType.trim() : null;
  const transport = typeof req.body?.transport === 'string' && req.body.transport.trim() ? req.body.transport.trim() : null;
  const groups = typeof req.body?.groups === 'string' && req.body.groups.trim() ? req.body.groups.trim() : null;
  const story = Array.isArray(req.body?.story)
    ? req.body.story.map((item: unknown) => String(item).trim()).filter(Boolean)
    : [];
  const includedItems = Array.isArray(req.body?.includedItems)
    ? req.body.includedItems.map((item: unknown) => String(item).trim()).filter(Boolean)
    : [];
  const recommendations = Array.isArray(req.body?.recommendations)
    ? req.body.recommendations.map((item: unknown) => String(item).trim()).filter(Boolean)
    : [];
  const faqs = Array.isArray(req.body?.faqs)
    ? req.body.faqs
        .map((item: { question?: unknown; answer?: unknown }) => ({
          question: String(item?.question ?? '').trim(),
          answer: String(item?.answer ?? '').trim(),
        }))
        .filter((item: { question: string; answer: string }) => item.question && item.answer)
    : [];
  const providedPackages = normalizeTourPackagesInput(req.body?.tourPackages);
  const legacyPriceOptions = normalizePriceOptionsInput(req.body?.priceOptions);
  const tourPackages: NormalizedTourPackage[] =
    providedPackages.length > 0
      ? providedPackages
      : legacyPriceOptions.length > 0
        ? [
            {
              id: 'package-main',
              title: 'Paquete principal',
              description: '',
              priceOptions: legacyPriceOptions,
            },
          ]
        : [];

  if (tourPackages.length === 0) {
    return res.status(400).json({ error: 'Cada tour debe tener al menos un paquete con titulo y precios.' });
  }

  const parsedFallbackPrice = Number(price);
  const fallbackPrice = Number.isFinite(parsedFallbackPrice) && parsedFallbackPrice >= 0 ? parsedFallbackPrice : 0;
  const effectiveTourPrice = getPrimaryTourPriceFromPackages(tourPackages, fallbackPrice);
  const featured = Boolean(req.body?.featured);
  const isDeleted = Boolean(req.body?.isDeleted);
  const deletedAt = typeof req.body?.deletedAt === 'string' && req.body.deletedAt ? new Date(req.body.deletedAt) : null;

  const availabilityCreateData = Array.isArray(availability)
    ? availability
        .map((item: { date?: string; maxPeople?: number }) => ({
          date: item?.date ? new Date(item.date) : null,
          maxPeople: Number(item?.maxPeople ?? 0),
        }))
        .filter((item: { date: Date | null; maxPeople: number }) => item.date && item.maxPeople > 0)
        .map((item: { date: Date | null; maxPeople: number }) => ({
          date: item.date as Date,
          maxPeople: item.maxPeople,
        }))
    : null;

  try {
    if (req.method === 'POST') {
      const nextCategoryId = await resolveCategoryId(prisma, parsedCategoryId);

      const tour = await prisma.tour.create({
        data: {
          title,
          description,
          price: effectiveTourPrice,
          minPeople,
          images,
          category: { connect: { id: nextCategoryId } },
          status: status || 'BORRADOR',
          country: country ?? undefined,
          zone: zone ?? undefined,
          durationDays: durationDays ?? undefined,
          durationHours: durationHours ?? undefined,
          activityType: activityType ?? undefined,
          difficulty: difficulty ?? undefined,
          rating: rating ?? undefined,
          reviews: reviews ?? undefined,
          guideType: guideType ?? undefined,
          transport: transport ?? undefined,
          groups: groups ?? undefined,
          story,
          includedItems,
          recommendations,
          faqs,
          tourPackages,
          featured,
          isDeleted,
          deletedAt: deletedAt ?? undefined,
          availability: availabilityCreateData
            ? {
                create: availabilityCreateData,
              }
            : undefined,
        },
        include: { availability: true, category: true },
      });

      return res.status(200).json(tour);
    }

    const id = getTourId(req);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID de tour invalido' });
    }

    if (req.method === 'DELETE') {
      await prisma.$transaction(async (tx) => {
        await tx.reservation.deleteMany({ where: { tourId: id } });
        await tx.availability.deleteMany({ where: { tourId: id } });
        await tx.tour.delete({ where: { id } });
      });

      return res.status(200).json({ ok: true, deletedId: id });
    }

    if (req.method === 'PATCH') {
      const action = req.body?.action;
      const explicitStatus = toValidStatus(req.body?.status);

      let nextStatus: ValidStatus | null = explicitStatus;
      if (!nextStatus && typeof action === 'string') {
        if (action === 'publish') nextStatus = 'ACTIVO';
        if (action === 'unpublish') nextStatus = 'NO_ACTIVO';
        if (action === 'draft') nextStatus = 'BORRADOR';
      }

      if (!nextStatus) {
        return res.status(400).json({ error: 'PATCH requiere un status valido o una accion (publish, unpublish, draft).' });
      }

      const updatedTour = await prisma.tour.update({
        where: { id },
        data: { status: nextStatus },
        include: { availability: true, category: true },
      });

      return res.status(200).json(updatedTour);
    }

    const tour = await prisma.$transaction(async (tx) => {
      const nextCategoryId = await resolveCategoryId(tx, parsedCategoryId);

      const updateData: Record<string, unknown> = {
        title,
        description,
        price: effectiveTourPrice,
        minPeople,
        images,
        category: { connect: { id: nextCategoryId } },
        status: status || 'BORRADOR',
        country,
        zone,
        durationDays,
        durationHours,
        activityType,
        difficulty,
        rating,
        reviews,
        guideType,
        transport,
        groups,
        story,
        includedItems,
        recommendations,
        faqs,
        tourPackages,
        featured,
        isDeleted,
        deletedAt,
      };

      let updatedTour;
      try {
        updatedTour = await tx.tour.update({
          where: { id },
          data: updateData,
        });
      } catch (error) {
        const unsupportedFields: string[] = [];
        if (isUnknownArgumentError(error, 'minPeople')) unsupportedFields.push('minPeople');
        if (isUnknownArgumentError(error, 'zone')) unsupportedFields.push('zone');
        if (isUnknownArgumentError(error, 'tourPackages')) unsupportedFields.push('tourPackages');

        if (!unsupportedFields.length) throw error;

        updatedTour = await tx.tour.update({
          where: { id },
          data: stripUnsupportedTourFields(updateData, unsupportedFields),
        });
      }

      if (availabilityCreateData) {
        await tx.availability.deleteMany({ where: { tourId: id } });
        if (availabilityCreateData.length > 0) {
          await tx.availability.createMany({
            data: availabilityCreateData.map((item) => ({ ...item, tourId: id })),
          });
        }
      }

      const withRelations = await tx.tour.findUnique({
        where: { id: updatedTour.id },
        include: { availability: true, category: true },
      });

      return withRelations;
    });

    return res.status(200).json(tour);
  } catch (error) {
    if (isUnknownArgumentError(error, 'minPeople')) {
      return res.status(500).json({
        error: 'El servidor no reconoce minPeople. Reinicia el servidor y sincroniza Prisma.',
      });
    }

    if (isUnknownArgumentError(error, 'zone')) {
      return res.status(500).json({
        error: 'El servidor no reconoce zone. Reinicia el servidor y sincroniza Prisma.',
      });
    }

    if (isUnknownArgumentError(error, 'tourPackages')) {
      return res.status(500).json({
        error: 'El servidor no reconoce tourPackages. Reinicia el servidor y sincroniza Prisma.',
      });
    }

    const detail = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Admin tour API error', { method: req.method, detail });

    return res.status(500).json({
      error: 'No se pudo guardar el tour en la base de datos.',
      ...(process.env.NODE_ENV !== 'production' ? { detail } : {}),
    });
  }
}
