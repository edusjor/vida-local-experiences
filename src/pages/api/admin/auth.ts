import type { NextApiRequest, NextApiResponse } from 'next';
import {
  clearAdminSessionCookie,
  createAdminSessionToken,
  getAdminCredentials,
  getAdminSessionFromRequest,
  setAdminSessionCookie,
} from '../../../lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const session = getAdminSessionFromRequest(req);
    if (!session.ok) {
      return res.status(401).json({ ok: false });
    }

    return res.status(200).json({ ok: true, username: session.username });
  }

  if (req.method === 'DELETE') {
    clearAdminSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    const { username, password } = req.body ?? {};
    const expected = getAdminCredentials();

    if (username !== expected.username || password !== expected.password) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = createAdminSessionToken(expected.username);
    setAdminSessionCookie(res, token);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
