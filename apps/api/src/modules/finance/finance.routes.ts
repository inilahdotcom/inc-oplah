import { Router } from 'express';
import { billingCreateSchema, billingPaySchema, dashboardQuery, exportQuery, idParam, moListQuery } from '@inc/shared';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import { paramId, validate } from '../../middleware/validate';
import * as fin from './finance.service';

// PRD §10. Daftar MO: semua role; ekspor SA/AS/FIN; penagihan SA/FIN; dashboard SA/FIN/VIEWER.
export const financeRouter = Router();
financeRouter.use(authenticate);

const byId = validate(idParam, 'params');

financeRouter.get('/media-orders', requireRole('viewMo'), validate(moListQuery, 'query'), async (req, res) => res.json(await fin.list(req, req.query as never)));
financeRouter.get('/finance/media-orders/export', requireRole('export'), validate(exportQuery, 'query'), async (req, res) => {
  const q = req.query as unknown as { format: 'xlsx' | 'csv' };
  const { body, fileName, type } = await fin.exportList(req, req.query as never, q.format);
  res.type(type).attachment(fileName).send(body);
});
financeRouter.get('/finance/dashboard', requireRole('viewFinanceDashboard'), validate(dashboardQuery, 'query'), async (req, res) =>
  res.json(await fin.dashboard(req, (req.query as { year?: number }).year)),
);
financeRouter.post('/media-orders/:id/billings', requireRole('manageBilling'), byId, validate(billingCreateSchema), async (req, res) =>
  res.status(201).json(await fin.createBilling(req, paramId(req), req.body)),
);
financeRouter.patch('/billings/:id', requireRole('manageBilling'), byId, validate(billingPaySchema), async (req, res) => res.json(await fin.payBilling(req, paramId(req), req.body)));
