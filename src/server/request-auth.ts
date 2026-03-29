import type { NextRequest } from 'next/server';
import { adminAuth } from '@/server/firebase-admin';

export class RequestAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.name = 'RequestAuthError';
  }
}

export async function requireUserIdFromRequest(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get('authorization') || '';
  const bearerPrefix = 'Bearer ';

  if (!authHeader.startsWith(bearerPrefix)) {
    throw new RequestAuthError('Missing bearer token', 401);
  }

  const token = authHeader.slice(bearerPrefix.length).trim();
  if (!token) {
    throw new RequestAuthError('Invalid bearer token', 401);
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    throw new RequestAuthError('Unauthorized token', 401);
  }
}
