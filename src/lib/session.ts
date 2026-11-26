import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'amaya_session';
const SESSION_DAYS = 7;

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'CUSTOMER';
  tier: 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE' | null;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 24) {
    // A predictable dev secret is acceptable locally; production must set one.
    return new TextEncoder().encode('amaya-development-fallback-secret-key-32chars');
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer('amaya')
    .setAudience('amaya-storefront')
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: 'amaya',
      audience: 'amaya-storefront',
    });
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: payload.role as SessionPayload['role'],
      tier: (payload.tier as SessionPayload['tier']) ?? null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return verifySession(token);
}
