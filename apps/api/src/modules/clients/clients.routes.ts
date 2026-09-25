import { Router } from 'express';
import { clientListQuery, clientSchema, idParam, similarClientQuery } from '@inc/shared';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import { paramId, validate } from '../../middleware/validate';
import * as clients from './clients.service';

export const clientsRouter = Router();
clientsRouter.use(authenticate, requireRole('viewClients'));

clientsRouter.get('/', validate(clientListQuery, 'query'), async (req, res) => {
  res.json(await clients.list(req, req.query as never));
});

clientsRouter.get('/similar', validate(similarClientQuery, 'query'), async (req, res) => {
  res.json({ data: await clients.similar(req, req.query as never) });
});

clientsRouter.get('/:id', validate(idParam, 'params'), async (req, res) => {
  res.json(await clients.get(req, paramId(req)));
});

clientsRouter.post('/', requireRole('manageClients'), validate(clientSchema), async (req, res) => {
  res.status(201).json(await clients.create(req, req.body));
});

clientsRouter.patch('/:id', requireRole('manageClients'), validate(idParam, 'params'), validate(clientSchema), async (req, res) => {
  res.json(await clients.update(req, paramId(req), req.body));
});

clientsRouter.delete('/:id', requireRole('manageClients'), validate(idParam, 'params'), async (req, res) => {
  await clients.remove(req, paramId(req));
  res.status(204).end();
});
