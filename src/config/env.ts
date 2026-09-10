import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_OWNER_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
  RABBITMQ_URL: z.string().min(1),
  CELEBRITY_THRESHOLD: z.coerce.number().int().positive().default(100000),
  TIMELINE_MAX_ITEMS: z.coerce.number().int().positive().default(1000),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(20),
  RABBITMQ_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  TRUST_PROXY: booleanString.default(true),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
