import { z } from "zod";

export const credentialsSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(1024),
  })
  .strict();
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["customer", "staff", "admin"]).default("customer"),
  name: z.string().default(""),
  phone: z.string().default(""),
  permissions: z.array(z.string()).default([]),
  preferences: z.record(z.string(), z.json()).default({}),
  email_verified: z.boolean().default(false),
});
export const loginResponseSchema = z.object({
  session_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expires_at: z.string().datetime({ offset: true }),
  user: userSchema,
});
export type Credentials = z.infer<typeof credentialsSchema>;
export type User = z.infer<typeof userSchema>;

export const registrationSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().min(1).max(120),
    password: z
      .string()
      .min(10)
      .max(1024)
      .regex(/[a-zA-Z]/)
      .regex(/[0-9]/),
  })
  .strict();
