import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^@[A-Za-z0-9_]{3,32}$/);

export const passwordSchema = z.string().min(8).max(128);

export const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const registerSchema = loginSchema;
