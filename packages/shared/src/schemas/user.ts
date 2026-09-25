import { z } from 'zod';
import { roles } from '../enums';
import { requiredText } from './common';

const password = z.string().min(8, 'Password minimal 8 karakter').max(100);

export const createUserSchema = z.object({
  name: requiredText('Nama'),
  email: z.string().trim().toLowerCase().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  role: z.enum(roles),
  salesId: z.string().uuid().nullish(),
  password,
});

export const updateUserSchema = createUserSchema
  .omit({ password: true, email: true })
  .partial()
  .extend({ isActive: z.boolean().optional(), password: password.optional() });
