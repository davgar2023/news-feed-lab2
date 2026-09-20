import { describe, expect, it, vi } from "vitest";

import type { AppConfig } from "./config/env.js";
import {
  createShutdown,
  startServer,
  type DatabaseLifecycle,
  type RabbitLifecycle,
  type RedisLifecycle,
} from "./server.js";

function config(): AppConfig {
  return {
    NODE_ENV: "test",
    PORT: 0,
    DATABASE_URL: "postgres://unused",
    DATABASE_POOL_MAX: 1,
    DATABASE_IDLE_TIMEOUT_MS: 1,
    DATABASE_CONNECTION_TIMEOUT_MS: 1,
    REDIS_URL: "redis://unused",
    REDIS_MAX_RETRIES_PER_REQUEST: 0,
    RABBITMQ_URL: "amqp://unused",
    CELEBRITY_THRESHOLD: 100,
    TIMELINE_MAX_ITEMS: 100,
    OUTBOX_POLL_INTERVAL_MS: 10,
    RABBITMQ_PREFETCH: 1,
    RABBITMQ_MAX_RETRIES: 0,
    RABBITMQ_RECONNECT_DELAY_MS: 1,
    TRUST_PROXY: false,
  };
}

function dependencies(calls: string[] = []) {
  const database: DatabaseLifecycle = {
    initializePool: vi.fn(() => calls.push("postgres:init")),
    healthCheck: vi.fn(async () => true),
    closePool: vi.fn(async () => {
      calls.push("postgres:close");
    }),
  };
  const redis: RedisLifecycle = {
    connect: vi.fn(async () => {
      calls.push("redis:connect");
    }),
    healthCheck: vi.fn(async () => true),
    shutdown: vi.fn(async () => {
      calls.push("redis:close");
    }),
  };
  const rabbitmq: RabbitLifecycle = {
    connect: vi.fn(async () => {
      calls.push("rabbit:connect");
    }),
    healthCheck: vi.fn(async () => true),
    close: vi.fn(async () => {
      calls.push("rabbit:close");
    }),
  };
  return { database, redis, rabbitmq };
}

describe("application server lifecycle", () => {
  it("initializes dependencies before accepting HTTP traffic", async () => {
    const calls: string[] = [];
    const injected = dependencies(calls);
    const running = await startServer({
      config: config(),
      ...injected,
      listenHttp: async (_server, port) => {
        calls.push(`http:listen:${port}`);
      },
    });

    expect(calls).toEqual(["postgres:init", "redis:connect", "rabbit:connect", "http:listen:0"]);
    await running.shutdown();
  });

  it("shuts down once in traffic, RabbitMQ, Redis, PostgreSQL order", async () => {
    const calls: string[] = [];
    const injected = dependencies(calls);
    const shutdown = createShutdown({
      stopHttp: async () => {
        calls.push("http:close");
      },
      ...injected,
    });

    await Promise.all([shutdown(), shutdown()]);

    expect(calls).toEqual(["http:close", "rabbit:close", "redis:close", "postgres:close"]);
  });

  it("continues ordered cleanup after a close failure", async () => {
    const calls: string[] = [];
    const injected = dependencies(calls);
    injected.rabbitmq.close = vi.fn(async () => {
      calls.push("rabbit:close");
      throw new Error("rabbit close failed");
    });
    const shutdown = createShutdown({
      stopHttp: async () => {
        calls.push("http:close");
      },
      ...injected,
    });

    await expect(shutdown()).rejects.toThrow("Application shutdown failed");
    expect(calls).toEqual(["http:close", "rabbit:close", "redis:close", "postgres:close"]);
  });
});
