import type { RequestHandler } from 'express';
import { permissions, type Permission } from '@inc/shared';
import { AppError } from '../lib/app-error';

/** RBAC backend (PRD §3). Selalu dipasang setelah `authenticate`. */
export const requireRole =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    const allowed = permissions[permission] as readonly string[];
    if (!req.user || !allowed.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'Anda tidak memiliki akses untuk aksi ini', 403));
    }
    next();
  };
