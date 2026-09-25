import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.parse(req[source]); // ZodError → 400 di error-handler
    // Express 5: req.query berupa getter, jadi ditimpa lewat defineProperty.
    Object.defineProperty(req, source, { value: parsed, writable: true, enumerable: true });
    next();
  };

/** `:id` yang sudah divalidasi `idParam` (Express 5 mengetik params sebagai string | string[]). */
export const paramId = (req: { params: Record<string, unknown> }) => req.params.id as string;
