import { Router } from 'express';
import { calculateSchema, cancelMoSchema, idParam, moDraftSchema } from '@inc/shared';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import { paramId, validate } from '../../middleware/validate';
import { attachmentUpload } from '../../lib/upload';
import * as mo from './media-orders.service';

// RBAC PRD §3 / §10. Daftar MO (GET /media-orders) ada di modul finance.
export const mediaOrdersRouter = Router();
mediaOrdersRouter.use(authenticate);

const byId = validate(idParam, 'params');
const edit = requireRole('editMo');

mediaOrdersRouter.post('/calculate', edit, validate(calculateSchema), async (req, res) => res.json(await mo.calculate(req, req.body)));
mediaOrdersRouter.post('/', edit, validate(moDraftSchema), async (req, res) => res.status(201).json(await mo.create(req, req.body)));
mediaOrdersRouter.get('/:id', requireRole('viewMo'), byId, async (req, res) => res.json(await mo.get(req, paramId(req))));
mediaOrdersRouter.get('/:id/history', requireRole('viewMo'), byId, async (req, res) => res.json({ data: await mo.history(req, paramId(req)) }));
// Body divalidasi di service setelah cek kunci, agar MO terkunci selalu 409 (bukan 400).
mediaOrdersRouter.patch('/:id', edit, byId, async (req, res) => res.json(await mo.update(req, paramId(req), req.body)));
mediaOrdersRouter.delete('/:id', edit, byId, async (req, res) => {
  await mo.remove(req, paramId(req));
  res.status(204).end();
});

mediaOrdersRouter.post('/:id/submit', requireRole('submitMo'), byId, async (req, res) => res.json(await mo.submit(req, paramId(req))));
mediaOrdersRouter.post('/:id/cancel', requireRole('cancelMo'), byId, validate(cancelMoSchema), async (req, res) =>
  res.json(await mo.cancel(req, paramId(req), req.body.reason)),
);
mediaOrdersRouter.post('/:id/revise', edit, byId, async (req, res) => res.status(201).json(await mo.revise(req, paramId(req))));
mediaOrdersRouter.post('/:id/duplicate', edit, byId, async (req, res) => res.status(201).json(await mo.duplicate(req, paramId(req))));
mediaOrdersRouter.post('/:id/attachments', edit, byId, attachmentUpload, async (req, res) =>
  res.status(201).json(await mo.addAttachment(req, paramId(req), req.file!)),
);

mediaOrdersRouter.get('/:id/pdf', requireRole('downloadMoPdf'), byId, async (req, res) => {
  const { body, fileName } = await mo.pdf(req, paramId(req));
  res.type('application/pdf').attachment(fileName).send(body);
});
mediaOrdersRouter.post('/:id/pdf/regenerate', requireRole('regenerateMoPdf'), byId, async (req, res) => {
  await mo.regeneratePdf(req, paramId(req));
  res.status(204).end();
});
