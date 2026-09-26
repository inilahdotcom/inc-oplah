import type { RequestHandler } from 'express';
import { can, type Permission } from '@inc/shared';
import { AppError } from '../lib/app-error';

/** RBAC backend (PRD §3). Selalu dipasang setelah `authenticate`. */
export const requireRole =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !can(req.user.role, permission)) {
      return next(new AppError('FORBIDDEN', 'Anda tidak memiliki akses untuk aksi ini', 403));
    }
    next();
  };
