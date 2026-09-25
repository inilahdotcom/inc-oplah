import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@inc/shared';
import { env } from '../config/env';
import { AppError } from '../lib/app-error';

export interface AuthPayload {
  sub: string;
  orgId: string;
  role: Role;
  salesId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const signAccessToken = (p: AuthPayload) =>
  jwt.sign(p, env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '15m' });

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return next(new AppError('UNAUTHENTICATED', 'Silakan login terlebih dahulu', 401));
  try {
    req.user = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AuthPayload;
    next();
  } catch {
    next(new AppError('UNAUTHENTICATED', 'Sesi berakhir, silakan login ulang', 401));
  }
};

/** Dipanggil di handler setelah `authenticate`; aman di-assert non-null. */
export const currentUser = (req: Express.Request): AuthPayload => req.user!;
