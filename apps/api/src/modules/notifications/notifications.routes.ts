import { Router } from 'express';
import { idParam, type NotificationDto } from '@inc/shared';
import { prisma } from '../../lib/prisma';
import { authenticate, currentUser } from '../../middleware/authenticate';
import { paramId, validate } from '../../middleware/validate';

// FR-NOT-01: notifikasi in-app milik user yang login (semua role).
export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', async (req, res) => {
  const userId = currentUser(req).sub;
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const data = rows.map(
    (n): NotificationDto => ({
      id: n.id,
      type: n.type,
      payload: n.payload as NotificationDto['payload'],
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }),
  );
  res.json({ data, unread });
});

notificationsRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: currentUser(req).sub, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});

notificationsRouter.post('/:id/read', validate(idParam, 'params'), async (req, res) => {
  await prisma.notification.updateMany({ where: { id: paramId(req), userId: currentUser(req).sub, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});
