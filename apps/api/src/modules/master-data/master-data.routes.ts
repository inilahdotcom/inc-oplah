import { Router } from 'express';
import { benefitTypeSchema, formOptionSchema, idParam, salesSchema, settingsSchema, signatorySchema } from '@inc/shared';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import { paramId, validate } from '../../middleware/validate';
import { pngUpload } from '../../lib/upload';
import * as md from './master-data.service';

// GET: semua user login (dipakai form MO). Mutasi: Super Admin (PRD §10).
export const masterDataRouter = Router();
masterDataRouter.use(authenticate);

const admin = requireRole('manageMasterData');
const byId = validate(idParam, 'params');

masterDataRouter.get('/sales', async (req, res) => res.json({ data: await md.listSales(req) }));
masterDataRouter.post('/sales', admin, validate(salesSchema), async (req, res) => res.status(201).json(await md.createSales(req, req.body)));
masterDataRouter.patch('/sales/:id', admin, byId, validate(salesSchema), async (req, res) => res.json(await md.updateSales(req, paramId(req), req.body)));
masterDataRouter.post('/sales/:id/signature', admin, byId, pngUpload, async (req, res) =>
  res.json(await md.uploadImage(req, paramId(req), { kind: 'sales', field: 'signatureKey' }, req.file!)),
);

masterDataRouter.get('/signatories', async (req, res) => res.json({ data: await md.listSignatories(req) }));
masterDataRouter.post('/signatories', admin, validate(signatorySchema), async (req, res) => res.status(201).json(await md.createSignatory(req, req.body)));
masterDataRouter.patch('/signatories/:id', admin, byId, validate(signatorySchema), async (req, res) =>
  res.json(await md.updateSignatory(req, paramId(req), req.body)),
);
masterDataRouter.post('/signatories/:id/signature', admin, byId, pngUpload, async (req, res) =>
  res.json(await md.uploadImage(req, paramId(req), { kind: 'signatory', field: 'signatureKey' }, req.file!)),
);
masterDataRouter.post('/signatories/:id/stamp', admin, byId, pngUpload, async (req, res) =>
  res.json(await md.uploadImage(req, paramId(req), { kind: 'signatory', field: 'stampKey' }, req.file!)),
);

masterDataRouter.get('/benefit-types', async (req, res) => res.json({ data: await md.listBenefitTypes(req) }));
masterDataRouter.post('/benefit-types', admin, validate(benefitTypeSchema), async (req, res) =>
  res.status(201).json(await md.createBenefitType(req, req.body)),
);
masterDataRouter.patch('/benefit-types/:id', admin, byId, validate(benefitTypeSchema), async (req, res) =>
  res.json(await md.updateBenefitType(req, paramId(req), req.body)),
);

masterDataRouter.get('/form-options', async (req, res) => res.json({ data: await md.listFormOptions(req) }));
masterDataRouter.post('/form-options', admin, validate(formOptionSchema), async (req, res) =>
  res.status(201).json(await md.createFormOption(req, req.body)),
);
masterDataRouter.patch('/form-options/:id', admin, byId, validate(formOptionSchema), async (req, res) =>
  res.json(await md.updateFormOption(req, paramId(req), req.body)),
);

masterDataRouter.get('/settings', admin, async (req, res) => res.json(await md.getSettings(req)));
masterDataRouter.patch('/settings', admin, validate(settingsSchema), async (req, res) => res.json(await md.updateSettings(req, req.body)));
