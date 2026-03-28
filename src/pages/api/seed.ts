import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Elimina datos previos
  await prisma.reservation.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.category.deleteMany();

  // Crea categorias
  const beach = await prisma.category.create({ data: { name: 'Playa' } });
  const mountain = await prisma.category.create({ data: { name: 'Montana' } });
  const city = await prisma.category.create({ data: { name: 'Ciudad' } });
  const adventure = await prisma.category.create({ data: { name: 'Aventura' } });
  const nature = await prisma.category.create({ data: { name: 'Naturaleza' } });

  // Crea tours de prueba
  const tours = [
    {
      title: 'Catamaran Bahia Dorada',
      description: 'Recorrido costero en catamaran con snorkel y sunset.',
      price: 125.0,
      images: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'],
      categoryId: beach.id,
    },
    {
      title: 'Sendero Montana Azul',
      description: 'Caminata guiada por bosque tropical y miradores.',
      price: 89.0,
      images: ['https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1200&q=80'],
      categoryId: mountain.id,
    },
    {
      title: 'City Walk Colonial',
      description: 'Ruta historica y gastronomica por el centro.',
      price: 68.0,
      images: ['https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80'],
      categoryId: city.id,
    },
    {
      title: 'Rafting Rio Esmeralda',
      description: 'Rafting nivel intermedio con equipo y guia profesional.',
      price: 98.0,
      images: ['https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1200&q=80'],
      categoryId: adventure.id,
    },
    {
      title: 'Canopy Zip Line Deluxe',
      description: 'Circuito de canopy con vistas panoramicas.',
      price: 110.0,
      images: ['https://images.unsplash.com/photo-1523430410476-0185cb1f6ff9?auto=format&fit=crop&w=1200&q=80'],
      categoryId: adventure.id,
    },
    {
      title: 'Safari de Manglares',
      description: 'Tour en bote para observar aves y fauna local.',
      price: 74.0,
      images: ['https://images.unsplash.com/photo-1526778548025-fa2f459cd5ce?auto=format&fit=crop&w=1200&q=80'],
      categoryId: nature.id,
    },
    {
      title: 'Noche de Bioluminiscencia',
      description: 'Experiencia nocturna en kayak con guia local.',
      price: 84.0,
      images: ['https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&w=1200&q=80'],
      categoryId: beach.id,
    },
    {
      title: 'Tour de Cascadas Secretas',
      description: 'Caminata suave y visita a tres cascadas escondidas.',
      price: 92.0,
      images: ['https://images.unsplash.com/photo-1437482078695-73f5ca6c96e2?auto=format&fit=crop&w=1200&q=80'],
      categoryId: nature.id,
    },
  ];

  for (const tour of tours) {
    const createdTour = await prisma.tour.create({ data: tour });
    // Disponibilidad de prueba
    await prisma.availability.create({
      data: {
        date: new Date('2026-03-20'),
        maxPeople: 10,
        tourId: createdTour.id,
      },
    });
    await prisma.availability.create({
      data: {
        date: new Date('2026-03-21'),
        maxPeople: 8,
        tourId: createdTour.id,
      },
    });
    await prisma.availability.create({
      data: {
        date: new Date('2026-03-24'),
        maxPeople: 12,
        tourId: createdTour.id,
      },
    });
  }

  res.status(200).json({ ok: true });
}
