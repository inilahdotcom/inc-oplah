import { Router } from 'express';
import { createUserSchema, idParam, updateUserSchema } from '@inc/shared';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import { paramId, validate } from '../../middleware/validate';
import * as users from './users.service';

export const usersRouter = Router();
usersRouter.use(authenticate, requireRole('manageUsers'));

usersRouter.get('/', async (req, res) => res.json({ data: await users.list(req) }));
usersRouter.post('/', validate(createUserSchema), async (req, res) => res.status(201).json(await users.create(req, req.body)));
usersRouter.patch('/:id', validate(idParam, 'params'), validate(updateUserSchema), async (req, res) =>
  res.json(await users.update(req, paramId(req), req.body)),
);
