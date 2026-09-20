import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import type { PoolConfig } from "pg";

import { createApp } from "./app.js";
import { loadConfig, type AppConfig } from "./config/env.js";
import { database as defaultDatabase } from "./infrastructure/database/index.js";
import { RabbitMQConnection } from "./infrastructure/messaging/index.js";
import { createRedisService } from "./infrastructure/redis/index.js";

export interface DatabaseLifecycle {
  initializePool(overrides?: PoolConfig): unknown;
  healthCheck(): Promise<boolean>;
  closePool(): Promise<void>;
}

export interface RedisLifecycle {
  connect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
}

export interface RabbitLifecycle {
  connect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}

export interface ShutdownResources {
  stopHttp(): Promise<void>;
  rabbitmq: Pick<RabbitLifecycle, "close">;
  redis: Pick<RedisLifecycle, "shutdown">;
  database: Pick<DatabaseLifecycle, "closePool">;
}

export interface StartServerOptions {
  config?: AppConfig;
  database?: DatabaseLifecycle;
  redis?: RedisLifecycle;
  rabbitmq?: RabbitLifecycle;
  createHttpServer?: typeof createServer;
  listenHttp?: (server: Server, port: number) => Promise<void>;
}

export interface RunningApplication {
  server: Server;
  shutdown(): Promise<void>;
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}

function stopHttpServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function createShutdown(resources: ShutdownResources): () => Promise<void> {
  let shutdown: Promise<void> | undefined;
  return () => {
    shutdown ??= (async () => {
      const errors: unknown[] = [];
      for (const close of [
        resources.stopHttp,
        () => resources.rabbitmq.close(),
        () => resources.redis.shutdown(),
        () => resources.database.closePool(),
      ]) {
        try {
          await close();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) throw new AggregateError(errors, "Application shutdown failed");
    })();
    return shutdown;
  };
}

export async function startServer(options: StartServerOptions = {}): Promise<RunningApplication> {
  const config = options.config ?? loadConfig();
  const database = options.database ?? defaultDatabase;
  const redis =
    options.redis ??
    createRedisService({
      url: config.REDIS_URL,
      maxTimelineItems: config.TIMELINE_MAX_ITEMS,
      redisOptions: { maxRetriesPerRequest: config.REDIS_MAX_RETRIES_PER_REQUEST },
    });
  const rabbitmq =
    options.rabbitmq ??
    new RabbitMQConnection({
      url: config.RABBITMQ_URL,
      prefetch: config.RABBITMQ_PREFETCH,
      maxRetries: config.RABBITMQ_MAX_RETRIES,
      reconnectDelayMs: config.RABBITMQ_RECONNECT_DELAY_MS,
    });

  database.initializePool({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    idleTimeoutMillis: config.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: config.DATABASE_CONNECTION_TIMEOUT_MS,
    allowExitOnIdle: config.NODE_ENV === "test",
  });
  try {
    await Promise.all([redis.connect(), rabbitmq.connect()]);
  } catch (error) {
    await createShutdown({
      stopHttp: async () => undefined,
      rabbitmq,
      redis,
      database,
    })().catch(() => undefined);
    throw error;
  }

  const app = createApp({
    trustProxy: config.TRUST_PROXY,
    health: { postgres: database, redis, rabbitmq },
  });
  const server = (options.createHttpServer ?? createServer)(app);
  const shutdown = createShutdown({
    stopHttp: () => stopHttpServer(server),
    rabbitmq,
    redis,
    database,
  });

  try {
    await (options.listenHttp ?? listen)(server, config.PORT);
  } catch (error) {
    await shutdown();
    throw error;
  }

  return { server, shutdown };
}

export function installSignalHandlers(
  application: Pick<RunningApplication, "shutdown">,
): () => void {
  let signalled = false;
  const handleSignal = () => {
    if (signalled) return;
    signalled = true;
    void application.shutdown().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
  return () => {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  };
}

async function main(): Promise<void> {
  const application = await startServer();
  installSignalHandlers(application);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
