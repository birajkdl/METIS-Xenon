import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'metis_station_mgmt_secret_key_nepal_met_2026';

/**
 * Generates a secure salt and PBKDF2 password hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
    const [, salt, hash] = parts;
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  } catch (err) {
    console.error("Password verification error:", err);
    return false;
  }
}

export interface MetisTokenPayload {
  uid: string;
  email: string;
  role: string;
  username?: string | null;
  office?: string | null;
  iss?: string;
  exp?: number;
  iat?: number;
}

/**
 * Issues a cryptographically signed HMAC-SHA256 session token
 */
export function generateMetisToken(payload: { uid: string; email: string; role: string; username?: string | null; office?: string | null }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iss: 'METIS_AUTH_ENGINE',
    exp: nowSec + (60 * 24 * 60 * 60), // 60 days validity
    iat: nowSec
  })).toString('base64url');
  
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `metis.${header}.${body}.${signature}`;
}

/**
 * Verifies a token issued by the native METIS auth engine
 */
export function verifyMetisToken(token: string): MetisTokenPayload | null {
  try {
    if (!token || !token.startsWith('metis.')) return null;
    const parts = token.slice(6).split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as MetisTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (data.exp && data.exp < nowSec) {
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}
