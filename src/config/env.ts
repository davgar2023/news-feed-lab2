import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_OWNER_URL: z.string().min(1).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  REDIS_URL: z.string().min(1),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().nonnegative().default(3),
  RABBITMQ_URL: z.string().min(1),
  CELEBRITY_THRESHOLD: z.coerce.number().int().positive().default(100000),
  TIMELINE_MAX_ITEMS: z.coerce.number().int().positive().default(1000),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(20),
  RABBITMQ_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  RABBITMQ_RECONNECT_DELAY_MS: z.coerce.number().int().positive().default(1000),
  TRUST_PROXY: booleanString.default(true),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
