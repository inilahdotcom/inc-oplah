import { Router } from 'express';
import { idParam, publicationBulkSchema, publicationSchema } from '@inc/shared';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import { paramId, validate } from '../../middleware/validate';
import { imageUpload } from '../../lib/upload';
import * as pub from './publications.service';

// PRD §10: GET semua role; tulis SA & Admin Sales (izin managePublications).
export const publicationsRouter = Router();
publicationsRouter.use(authenticate);

const byId = validate(idParam, 'params');
const manage = requireRole('managePublications');

publicationsRouter.get('/media-orders/:id/publications', requireRole('viewMo'), byId, async (req, res) => res.json({ data: await pub.list(req, paramId(req)) }));
publicationsRouter.post('/media-orders/:id/publications', manage, byId, validate(publicationSchema), async (req, res) =>
  res.status(201).json(await pub.create(req, paramId(req), req.body)),
);
publicationsRouter.post('/media-orders/:id/publications/bulk', manage, byId, validate(publicationBulkSchema), async (req, res) =>
  res.status(201).json(await pub.bulk(req, paramId(req), req.body)),
);
publicationsRouter.patch('/publications/:id', manage, byId, validate(publicationSchema), async (req, res) => res.json(await pub.update(req, paramId(req), req.body)));
publicationsRouter.delete('/publications/:id', manage, byId, async (req, res) => res.json(await pub.remove(req, paramId(req))));
publicationsRouter.post('/publications/:id/screenshot', manage, byId, imageUpload, async (req, res) =>
  res.json(await pub.uploadScreenshot(req, paramId(req), req.file!)),
);
