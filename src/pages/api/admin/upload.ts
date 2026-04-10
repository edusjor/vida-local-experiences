import fs from 'fs/promises';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { type File as FormidableFile } from 'formidable';
import { requireAdminSession } from '../../../lib/adminAuth';

const allowedImageExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.avif',
]);

export const config = {
  api: {
    bodyParser: false,
  },
};

function toArray(value: FormidableFile | FormidableFile[] | undefined): FormidableFile[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function parseForm(req: NextApiRequest): Promise<formidable.Files> {
  const form = formidable({
    multiples: true,
    maxFileSize: Number.MAX_SAFE_INTEGER,
    maxTotalFileSize: Number.MAX_SAFE_INTEGER,
    filter: ({ mimetype, originalFilename }) => {
      if (typeof mimetype === 'string' && mimetype.startsWith('image/')) return true;
      const ext = path.extname(originalFilename || '').toLowerCase();
      return allowedImageExtensions.has(ext);
    },
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, _fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(files);
    });
  });
}

function getSafeExtension(file: FormidableFile): string {
  const fromName = path.extname(file.originalFilename || '').toLowerCase();
  if (fromName && allowedImageExtensions.has(fromName)) return fromName;

  const mime = String(file.mimetype || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  return '.jpg';
}

async function moveFileWithFallback(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch {
    await fs.copyFile(sourcePath, destinationPath);
    await fs.unlink(sourcePath).catch(() => undefined);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  if (!requireAdminSession(req, res)) return;

  try {
    const files = await parseForm(req);
    const uploadDir = path.join(process.cwd(), 'uploads', 'tours');
    await fs.mkdir(uploadDir, { recursive: true });

    const candidates = [
      ...toArray(files.images as FormidableFile | FormidableFile[] | undefined),
      ...toArray(files.file as FormidableFile | FormidableFile[] | undefined),
      ...toArray(files.files as FormidableFile | FormidableFile[] | undefined),
    ];

    if (!candidates.length) {
      return res.status(400).json({ error: 'No se recibieron imagenes validas.' });
    }

    const urls: string[] = [];
    for (const file of candidates) {
      if (!file?.filepath) continue;
      const ext = getSafeExtension(file);
      const baseName = path.basename(file.originalFilename || '', path.extname(file.originalFilename || ''))
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita tildes
        .replace(/ñ/g, 'n')
        .replace(/[^a-z0-9._\- ]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        || `tour-${Date.now()}`;
      let name = `${baseName}${ext}`;
      // Avoid overwriting an existing file with the same name
      if (await fs.access(path.join(uploadDir, name)).then(() => true).catch(() => false)) {
        name = `${baseName}-${Date.now()}${ext}`;
      }
      const destination = path.join(uploadDir, name);
      await moveFileWithFallback(file.filepath, destination);
      urls.push(`/uploads/tours/${name}`);
    }

    return res.status(200).json({ urls });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: 'No se pudieron subir las imagenes.', detail });
  }
}
