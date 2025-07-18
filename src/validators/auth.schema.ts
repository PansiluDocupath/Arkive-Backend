import { z } from 'zod';

export const RegisterSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  organizationId: z.string().min(1, 'Organization is required')
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password is required')
});
