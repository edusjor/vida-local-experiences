import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

interface AdminAuthConfig {
  sessionSecret: string;
  username: string;
  password: string;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function readRequiredEnv(name: 'ADMIN_SESSION_SECRET' | 'ADMIN_USERNAME' | 'ADMIN_PASSWORD'): string | null {
  const value = process.env[name];
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getAdminAuthConfig(): AdminAuthConfig | null {
  const sessionSecret = readRequiredEnv('ADMIN_SESSION_SECRET');
  const username = readRequiredEnv('ADMIN_USERNAME');
  const password = readRequiredEnv('ADMIN_PASSWORD');

  if (!sessionSecret || !username || !password) return null;
  return { sessionSecret, username, password };
}

export function getAdminAuthMissingEnv(): string[] {
  return ['ADMIN_SESSION_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'].filter(
    (name) => !readRequiredEnv(name as 'ADMIN_SESSION_SECRET' | 'ADMIN_USERNAME' | 'ADMIN_PASSWORD'),
  );
}

function signPayload(encodedPayload: string): string {
  const config = getAdminAuthConfig();
  if (!config) {
    throw new Error('Admin auth config is incomplete');
  }

  return crypto.createHmac('sha256', config.sessionSecret).update(encodedPayload).digest('base64url');
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
  if (!getAdminAuthConfig()) return { ok: false };

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

export function getAdminCredentials(): { username: string; password: string } | null {
  const config = getAdminAuthConfig();
  if (!config) return null;

  return {
    username: config.username,
    password: config.password,
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
  if (!getAdminAuthConfig()) {
    res.status(503).json({ error: 'Configuracion admin incompleta' });
    return false;
  }

  const session = getAdminSessionFromRequest(req);
  if (session.ok) return true;
  res.status(401).json({ error: 'No autorizado' });
  return false;
}
