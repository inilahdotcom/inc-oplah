import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from '@inc/shared';
import { env } from '../../config/env';
import { authenticate, currentUser } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as auth from './auth.service';

const COOKIE = 'refresh_token';
const cookieOpts = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
};

const setRefreshCookie = (res: Response, token: string) => res.cookie(COOKIE, token, { ...cookieOpts, maxAge: auth.REFRESH_TTL_MS });

const limiter = (message: string) =>
  rateLimit({
    windowMs: 60_000,
    limit: 5,
    skip: () => env.NODE_ENV === 'test',
    handler: (_req, res) => res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message, details: [] } }),
  });
const loginLimiter = limiter('Terlalu banyak percobaan login, coba lagi dalam 1 menit');
const resetLimiter = limiter('Terlalu banyak permintaan, coba lagi dalam 1 menit');

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { refreshToken, ...body } = await auth.login(req.body, req.ip, req.get('user-agent'));
  setRefreshCookie(res, refreshToken).json(body);
});

authRouter.post('/refresh', async (req, res) => {
  const { refreshToken, ...body } = await auth.refresh(req.cookies?.[COOKIE], req.get('user-agent'));
  setRefreshCookie(res, refreshToken).json(body);
});

authRouter.post('/logout', async (req, res) => {
  await auth.logout(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, cookieOpts).status(204).end();
});

authRouter.get('/me', authenticate, async (req, res) => {
  const u = currentUser(req);
  res.json(await auth.me(u.sub, u.orgId));
});

authRouter.post('/forgot-password', resetLimiter, validate(forgotPasswordSchema), async (req, res) => {
  await auth.forgotPassword(req.body.email);
  res.status(204).end();
});

authRouter.post('/reset-password', resetLimiter, validate(resetPasswordSchema), async (req, res) => {
  await auth.resetPassword(req.body, req.ip);
  res.status(204).end();
});
