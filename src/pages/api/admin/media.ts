import fs from 'fs/promises';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminSession } from '../../../lib/adminAuth';
import { prisma } from '../../../lib/prisma';

type LinkedTour = {
  id: number;
  title: string;
};

type MediaStatus = 'active' | 'trash';

type MediaItem = {
  id: string;
  status: MediaStatus;
  name: string;
  relativePath: string;
  url: string;
  extension: string;
  size: number;
  updatedAt: string;
  isImage: boolean;
  linkedTours: LinkedTour[];
};

type TrashManifest = Record<
  string,
  {
    originalRelativePath: string;
    trashedAt: string;
  }
>;

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const TRASH_ROOT = path.join(UPLOADS_ROOT, '.trash');
const TRASH_MANIFEST_PATH = path.join(TRASH_ROOT, 'manifest.json');

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif']);

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function sanitizeRelPath(input: string): string | null {
  const normalized = path.posix.normalize(String(input || '').replace(/\\/g, '/'));
  if (!normalized || normalized.startsWith('..') || normalized.includes('/../')) return null;
  if (normalized.startsWith('/')) return null;
  return normalized;
}

function isImageFile(fileName: string): boolean {
  return imageExtensions.has(path.extname(fileName).toLowerCase());
}

function buildItemId(status: MediaStatus, relPath: string): string {
  return `${status}:${relPath}`;
}

function parseItemId(value: unknown): { status: MediaStatus; relPath: string } | null {
  if (typeof value !== 'string') return null;
  const [statusRaw, ...rest] = value.split(':');
  const relRaw = rest.join(':');
  const status: MediaStatus = statusRaw === 'trash' ? 'trash' : statusRaw === 'active' ? 'active' : null as never;
  if (!status) return null;
  const relPath = sanitizeRelPath(relRaw);
  if (!relPath) return null;
  return { status, relPath };
}

async function readTrashManifest(): Promise<TrashManifest> {
  try {
    const raw = await fs.readFile(TRASH_MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw) as TrashManifest;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

async function writeTrashManifest(manifest: TrashManifest): Promise<void> {
  await fs.mkdir(TRASH_ROOT, { recursive: true });
  await fs.writeFile(TRASH_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

async function walkFiles(rootPath: string, relativeBase = ''): Promise<string[]> {
  let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
  try {
    const dirents = await fs.readdir(path.join(rootPath, relativeBase), { withFileTypes: true, encoding: 'utf8' });
    entries = dirents as Array<{ name: string; isDirectory: () => boolean }>;
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const nextRel = toPosix(path.posix.join(relativeBase, entry.name));
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootPath, nextRel)));
      continue;
    }
    files.push(nextRel);
  }

  return files;
}

function getUploadRelPathFromTourImage(value: string): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (!normalized.startsWith('/uploads/')) return null;
  const rel = sanitizeRelPath(normalized.slice('/uploads/'.length));
  return rel;
}

async function buildLinkedToursMap(): Promise<Map<string, LinkedTour[]>> {
  const tours = await prisma.tour.findMany({
    select: {
      id: true,
      title: true,
      images: true,
    },
  });

  const map = new Map<string, LinkedTour[]>();

  tours.forEach((tour) => {
    const linkedTour: LinkedTour = { id: tour.id, title: tour.title };
    (tour.images || []).forEach((image) => {
      const rel = getUploadRelPathFromTourImage(image);
      if (!rel) return;
      const current = map.get(rel) || [];
      map.set(rel, [...current, linkedTour]);
    });
  });

  return map;
}

async function buildActiveItems(linkedToursMap: Map<string, LinkedTour[]>): Promise<MediaItem[]> {
  const allRelPaths = await walkFiles(UPLOADS_ROOT);
  const activeRelPaths = allRelPaths.filter((relPath) => relPath !== '.trash/manifest.json' && !relPath.startsWith('.trash/'));

  const items: MediaItem[] = [];
  for (const relPath of activeRelPaths) {
    const absPath = path.join(UPLOADS_ROOT, relPath);
    let stats;
    try {
      stats = await fs.stat(absPath);
    } catch {
      continue;
    }

    const name = path.basename(relPath);
    const extension = path.extname(name).toLowerCase();

    items.push({
      id: buildItemId('active', relPath),
      status: 'active',
      name,
      relativePath: relPath,
      url: `/uploads/${relPath}`,
      extension,
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
      isImage: isImageFile(name),
      linkedTours: linkedToursMap.get(relPath) || [],
    });
  }

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function buildTrashItems(manifest: TrashManifest): Promise<MediaItem[]> {
  const trashRelPaths = (await walkFiles(TRASH_ROOT)).filter((relPath) => relPath !== 'manifest.json');

  const items: MediaItem[] = [];
  for (const trashRelPath of trashRelPaths) {
    const absPath = path.join(TRASH_ROOT, trashRelPath);
    let stats;
    try {
      stats = await fs.stat(absPath);
    } catch {
      continue;
    }

    const name = path.basename(trashRelPath);
    const extension = path.extname(name).toLowerCase();
    const trashedAt = manifest[trashRelPath]?.trashedAt;

    items.push({
      id: buildItemId('trash', trashRelPath),
      status: 'trash',
      name,
      relativePath: `.trash/${trashRelPath}`,
      url: `/uploads/.trash/${trashRelPath}`,
      extension,
      size: stats.size,
      updatedAt: trashedAt || stats.mtime.toISOString(),
      isImage: isImageFile(name),
      linkedTours: [],
    });
  }

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function getUniqueRestorePath(originalRelativePath: string): Promise<string> {
  const parsed = path.posix.parse(originalRelativePath);
  const safeDir = parsed.dir || '';
  const safeExt = parsed.ext || '';
  const safeName = parsed.name || 'archivo';

  const firstCandidate = toPosix(path.posix.join(safeDir, `${safeName}${safeExt}`));
  try {
    await fs.access(path.join(UPLOADS_ROOT, firstCandidate));
  } catch {
    return firstCandidate;
  }

  for (let index = 1; index <= 9999; index += 1) {
    const nextCandidate = toPosix(path.posix.join(safeDir, `${safeName}-restaurado-${index}${safeExt}`));
    try {
      await fs.access(path.join(UPLOADS_ROOT, nextCandidate));
    } catch {
      return nextCandidate;
    }
  }

  return toPosix(path.posix.join(safeDir, `${safeName}-restaurado-${Date.now()}${safeExt}`));
}

function parseIdsFromBody(body: unknown): string[] {
  const source = body as { ids?: unknown };
  if (!Array.isArray(source?.ids)) return [];
  return source.ids.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminSession(req, res)) return;

  if (req.method === 'GET') {
    try {
      const linkedMap = await buildLinkedToursMap();
      const manifest = await readTrashManifest();
      const [activeItems, trashItems] = await Promise.all([
        buildActiveItems(linkedMap),
        buildTrashItems(manifest),
      ]);

      return res.status(200).json({
        items: [...activeItems, ...trashItems],
        summary: {
          active: activeItems.length,
          trash: trashItems.length,
          linked: activeItems.filter((item) => item.linkedTours.length > 0).length,
          unlinked: activeItems.filter((item) => item.linkedTours.length === 0).length,
        },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      return res.status(500).json({ error: 'No se pudo listar los medios.', detail });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const action = String((req.body as { action?: unknown })?.action || '').trim();
  const ids = parseIdsFromBody(req.body);
  if (!action || !ids.length) {
    return res.status(400).json({ error: 'Accion o ids invalidos' });
  }

  try {
    await fs.mkdir(TRASH_ROOT, { recursive: true });
    const manifest = await readTrashManifest();

    if (action === 'trash') {
      let moved = 0;

      for (const itemId of ids) {
        const parsedId = parseItemId(itemId);
        if (!parsedId || parsedId.status !== 'active') continue;

        const sourceAbsPath = path.join(UPLOADS_ROOT, parsedId.relPath);
        const sourceSafe = sanitizeRelPath(parsedId.relPath);
        if (!sourceSafe) continue;

        const sourceName = path.basename(sourceSafe);
        const trashRelPath = toPosix(path.posix.join('files', `${Date.now()}-${Math.round(Math.random() * 1e9)}-${sourceName}`));
        const destinationAbsPath = path.join(TRASH_ROOT, trashRelPath);

        try {
          await fs.mkdir(path.dirname(destinationAbsPath), { recursive: true });
          await fs.rename(sourceAbsPath, destinationAbsPath);
          manifest[trashRelPath] = {
            originalRelativePath: sourceSafe,
            trashedAt: new Date().toISOString(),
          };
          moved += 1;
        } catch {
          // Skip files that fail to move.
        }
      }

      await writeTrashManifest(manifest);
      return res.status(200).json({ ok: true, moved });
    }

    if (action === 'restore') {
      let restored = 0;

      for (const itemId of ids) {
        const parsedId = parseItemId(itemId);
        if (!parsedId || parsedId.status !== 'trash') continue;

        const trashRelPath = parsedId.relPath;
        const sourceAbsPath = path.join(TRASH_ROOT, trashRelPath);
        const originalFromManifest = sanitizeRelPath(manifest[trashRelPath]?.originalRelativePath || '') || path.basename(trashRelPath);
        const restoreRelPath = await getUniqueRestorePath(originalFromManifest);
        const destinationAbsPath = path.join(UPLOADS_ROOT, restoreRelPath);

        try {
          await fs.mkdir(path.dirname(destinationAbsPath), { recursive: true });
          await fs.rename(sourceAbsPath, destinationAbsPath);
          delete manifest[trashRelPath];
          restored += 1;
        } catch {
          // Skip files that fail to restore.
        }
      }

      await writeTrashManifest(manifest);
      return res.status(200).json({ ok: true, restored });
    }

    if (action === 'delete') {
      let deleted = 0;

      for (const itemId of ids) {
        const parsedId = parseItemId(itemId);
        if (!parsedId || parsedId.status !== 'trash') continue;

        const trashRelPath = parsedId.relPath;
        const targetAbsPath = path.join(TRASH_ROOT, trashRelPath);

        try {
          await fs.unlink(targetAbsPath);
          delete manifest[trashRelPath];
          deleted += 1;
        } catch {
          // Skip files that fail to delete.
        }
      }

      await writeTrashManifest(manifest);
      return res.status(200).json({ ok: true, deleted });
    }

    return res.status(400).json({ error: 'Accion no soportada' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: 'No se pudo ejecutar la accion sobre medios.', detail });
  }
}
