import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { AppError } from './lib/app-error';
import { errorHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { clientsRouter } from './modules/clients/clients.routes';
import { masterDataRouter } from './modules/master-data/master-data.routes';
import { mediaOrdersRouter } from './modules/media-orders/media-orders.routes';
import { publicationsRouter } from './modules/publications/publications.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()), credentials: true, exposedHeaders: ['Content-Disposition'] }));
app.use(pinoHttp({ logger, serializers: { req: (r) => ({ method: r.method, url: r.url }), res: (r) => ({ statusCode: r.statusCode }) } }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 300, skip: () => env.NODE_ENV === 'test' }));

const api = express.Router();
api.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});
api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/clients', clientsRouter);
api.use('/notifications', notificationsRouter);
api.use(publicationsRouter); // /media-orders/:id/publications, /publications/:id
api.use('/media-orders', mediaOrdersRouter);
api.use(masterDataRouter); // /sales, /signatories, /benefit-types, /form-options, /settings
api.use((_req, _res, next) => next(new AppError('NOT_FOUND', 'Endpoint tidak ditemukan', 404)));

app.use('/api/v1', api);
app.use(errorHandler);
