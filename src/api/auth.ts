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

export async function loginWithPassword(username: string, password: string): Promise<string | null> {
  const sqlite = getSqlite();

  // Normalize: strip accents for flexible matching (Joaquin = Joaquín)
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normalized = normalize(username);

  // Get all users and match flexibly
  const allUsers = sqlite.prepare(
    'SELECT id, phone, name, password_hash, password_salt FROM users WHERE password_hash IS NOT NULL'
  ).all() as any[];

  const user = allUsers.find((u: any) =>
    normalize(u.name || '') === normalized || u.phone === username
  );

  if (!user || !user.password_hash || !user.password_salt) {
    logger.warn({ username }, 'Login attempt: user not found or no password set');
    return null;
  }

  if (!verifyPassword(password, user.password_hash, user.password_salt)) {
    logger.warn({ username }, 'Login attempt: wrong password');
    return null;
  }

  // Generate JWT (30 day expiry)
  const payload = JSON.stringify({
    userId: user.id,
    phone: user.phone,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  const sig = createHmac('sha256', config.jwtSecret).update(payload).digest('hex');
  const jwt = Buffer.from(payload).toString('base64') + '.' + sig;

  logger.info({ userId: user.id }, 'Login successful');
  return jwt;
}

// ── Set/update password for a user ──

export function setUserPassword(userId: number, password: string): void {
  const sqlite = getSqlite();
  const { hash, salt } = hashPassword(password);
  sqlite.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, userId);
  logger.info({ userId }, 'Password updated');
}

// ── Verify JWT token from request ──

export function verifyJwt(token: string): { userId: number; phone: string } | null {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;

    const payload = Buffer.from(payloadB64, 'base64').toString();
    const expectedSig = createHmac('sha256', config.jwtSecret).update(payload).digest('hex');

    if (sig !== expectedSig) return null;

    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return null;

    return { userId: data.userId, phone: data.phone };
  } catch {
    return null;
  }
}

// ── Magic link (kept for future WhatsApp integration) ──

export async function requestMagicLink(phone: string): Promise<boolean> {
  // TODO: re-enable when WhatsApp is connected
  logger.info({ phone }, 'Magic link requested but WhatsApp not connected');
  return false;
}
