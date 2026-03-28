import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || 'dev-admin-session-secret-change-me';
}

function signPayload(encodedPayload: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function parseCookies(rawCookie: string | undefined): Record<string, string> {
  if (!rawCookie) return {};
  return rawCookie.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export function createAdminSessionToken(username: string): string {
  const payload = {
    username,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string): { ok: boolean; username?: string } {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return { ok: false };

  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return { ok: false };

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as { username?: string; exp?: number };
    if (!parsed?.username || !parsed?.exp) return { ok: false };
    if (Date.now() > parsed.exp) return { ok: false };
    return { ok: true, username: parsed.username };
  } catch {
    return { ok: false };
  }
}

export function getAdminCredentials(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  };
}

export function setAdminSessionCookie(res: NextApiResponse, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS};${secure ? ' Secure;' : ''}`,
  );
}

export function clearAdminSessionCookie(res: NextApiResponse): void {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0;${secure ? ' Secure;' : ''}`,
  );
}

export function getAdminSessionFromRequest(req: NextApiRequest): { ok: boolean; username?: string } {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[ADMIN_COOKIE_NAME];
  if (!token) return { ok: false };
  return verifyAdminSessionToken(token);
}

export function requireAdminSession(req: NextApiRequest, res: NextApiResponse): boolean {
  const session = getAdminSessionFromRequest(req);
  if (session.ok) return true;
  res.status(401).json({ error: 'No autorizado' });
  return false;
}
