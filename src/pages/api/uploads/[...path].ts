import fs from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method not allowed');
  }

  const parts = Array.isArray(req.query.path) ? req.query.path : [];
  if (!parts.length) {
    return res.status(404).end('Not found');
  }

  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const targetPath = path.normalize(path.join(uploadsRoot, ...parts));

  if (!targetPath.startsWith(uploadsRoot)) {
    return res.status(400).end('Invalid path');
  }

  try {
    const fileStats = await stat(targetPath);
    if (!fileStats.isFile()) {
      return res.status(404).end('Not found');
    }

    res.setHeader('Content-Type', getContentType(targetPath));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(fileStats.size));

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    const stream = fs.createReadStream(targetPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).end('Not found');
        return;
      }

      res.destroy();
    });

    stream.pipe(res);
    return;
  } catch {
    return res.status(404).end('Not found');
  }
}