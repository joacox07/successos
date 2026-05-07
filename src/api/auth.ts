import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'crypto';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { getSqlite } from '../db/client.js';

// ── Password hashing ──

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? randomBytes(16).toString('hex');
  const hash = scryptSync(password, s, 64).toString('hex');
  return { hash, salt: s };
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Login with username/password ──

export type LoginResult =
  | { ok: true; token: string; profileComplete: boolean; isAdmin: false }
  | { ok: true; token: string; isAdmin: true }
  | { ok: false };

export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Check admin credentials first
  if (normalize(username) === normalize(config.adminUsername) && password === config.adminPassword) {
    const payload = JSON.stringify({
      isAdmin: true,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    const sig = createHmac('sha256', config.jwtSecret).update(payload).digest('hex');
    const token = Buffer.from(payload).toString('base64') + '.' + sig;
    logger.info('Admin login successful');
    return { ok: true, token, isAdmin: true };
  }

  const sqlite = getSqlite();
  const normalized = normalize(username);

  const allUsers = sqlite.prepare(
    'SELECT id, phone, name, username, password_hash, password_salt, profile_complete FROM users WHERE password_hash IS NOT NULL'
  ).all() as any[];

  const user = allUsers.find((u: any) => {
    const fullName = normalize(u.name || '');
    const firstName = fullName.split(' ')[0];
    const handle = normalize(u.username || '');
    return fullName === normalized || firstName === normalized || handle === normalized || u.phone === username;
  });

  if (!user || !user.password_hash || !user.password_salt) {
    logger.warn({ username }, 'Login attempt: user not found or no password set');
    return { ok: false };
  }

  if (!verifyPassword(password, user.password_hash, user.password_salt)) {
    logger.warn({ username }, 'Login attempt: wrong password');
    return { ok: false };
  }

  const profileComplete = !!user.profile_complete;
  const payload = JSON.stringify({
    userId: user.id,
    phone: user.phone,
    isAdmin: false,
    profileComplete,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  const sig = createHmac('sha256', config.jwtSecret).update(payload).digest('hex');
  const token = Buffer.from(payload).toString('base64') + '.' + sig;

  logger.info({ userId: user.id }, 'Login successful');
  return { ok: true, token, profileComplete, isAdmin: false };
}

// ── Set/update password for a user ──

export function setUserPassword(userId: number, password: string): void {
  const sqlite = getSqlite();
  const { hash, salt } = hashPassword(password);
  sqlite.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, userId);
  logger.info({ userId }, 'Password updated');
}

// ── Verify JWT token from request ──

export function verifyJwt(token: string): { userId: number; phone: string; isAdmin: false; profileComplete: boolean } | { isAdmin: true } | null {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;

    const payload = Buffer.from(payloadB64, 'base64').toString();
    const expectedSig = createHmac('sha256', config.jwtSecret).update(payload).digest('hex');

    if (sig !== expectedSig) return null;

    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return null;

    if (data.isAdmin) return { isAdmin: true };
    return { userId: data.userId, phone: data.phone, isAdmin: false, profileComplete: !!data.profileComplete };
  } catch {
    return null;
  }
}

// ── Generate user token (used after profile setup) ──

export function generateUserToken(userId: number, phone: string, profileComplete: boolean): string {
  const payload = JSON.stringify({
    userId,
    phone,
    isAdmin: false,
    profileComplete,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  const sig = createHmac('sha256', config.jwtSecret).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

// ── Magic link (kept for future WhatsApp integration) ──

export async function requestMagicLink(phone: string): Promise<boolean> {
  // TODO: re-enable when WhatsApp is connected
  logger.info({ phone }, 'Magic link requested but WhatsApp not connected');
  return false;
}
