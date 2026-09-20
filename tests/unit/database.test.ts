import { beforeEach, describe, expect, it, vi } from "vitest";

const pgState = vi.hoisted(() => ({
  instances: [] as Array<{
    connect: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  }>,
  failConnections: 0,
}));

vi.mock("pg", () => ({
  Pool: class MockPool {
    readonly on = vi.fn();
    readonly end = vi.fn().mockResolvedValue(undefined);
    readonly connect;

    constructor() {
      const client = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      this.connect = vi.fn(async () => {
        if (pgState.failConnections > 0) {
          pgState.failConnections -= 1;
          throw new Error("database unavailable");
        }
        return client;
      });
      pgState.instances.push(this);
    }
  },
}));

import {
  closePool,
  Database,
  getPool,
  healthCheck,
  initializePool,
} from "../../src/infrastructure/database/Database.js";

describe("Database process pool", () => {
  beforeEach(async () => {
    await closePool();
    pgState.instances.length = 0;
    pgState.failConnections = 0;
  });

  it("shares exactly one pool between the module API and every Database facade", () => {
    const first = initializePool({ connectionString: "postgres://test" });
    const second = getPool();
    const facadePool = new Database().initializePool({ connectionString: "postgres://ignored" });

    expect(first).toBe(second);
    expect(facadePool).toBe(first);
    expect(pgState.instances).toHaveLength(1);
  });

  it("closes once and creates a fresh pool on the next request", async () => {
    const first = initializePool({ connectionString: "postgres://test" });
    await closePool();
    await closePool();

    expect(pgState.instances[0]?.end).toHaveBeenCalledOnce();
    const recovered = initializePool({ connectionString: "postgres://test" });
    expect(recovered).not.toBe(first);
    expect(pgState.instances).toHaveLength(2);
  });

  it("reports a transient connection failure and recovers without replacing the pool", async () => {
    initializePool({ connectionString: "postgres://test" });
    pgState.failConnections = 1;

    await expect(healthCheck()).resolves.toBe(false);
    await expect(healthCheck()).resolves.toBe(true);
    expect(pgState.instances).toHaveLength(1);
    expect(pgState.instances[0]?.connect).toHaveBeenCalledTimes(2);
  });
});
