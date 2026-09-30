import { z } from 'zod';
import { password } from './user';

const email = z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password wajib diisi'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ token: z.string().min(1), password });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
