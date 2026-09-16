import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { describe, expect, it, type TestContext } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const suiteReason = databaseUrl
  ? ""
  : " (skipped: DATABASE_URL is not set; start PostgreSQL and run migrations)";

async function runtimePool(context: TestContext): Promise<Pool | undefined> {
  if (!databaseUrl) {
    context.skip("DATABASE_URL is not set; start PostgreSQL and run migrations");
    return undefined;
  }
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 1_500 });
  try {
    await pool.query("SELECT 1");
    return pool;
  } catch (error) {
    await pool.end().catch(() => undefined);
    context.skip(`PostgreSQL is unavailable: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}

describe(`runtime database permissions${suiteReason}`, () => {
  it("denies direct business-table reads to newsfeed_app", async (context) => {
    const pool = await runtimePool(context);
    if (!pool) return;
    try {
      await expect(pool.query("SELECT * FROM public.users LIMIT 1")).rejects.toMatchObject({
        code: "42501",
      });
    } finally {
      await pool.end();
    }
  });

  it("allows newsfeed_app to execute an approved pkg_users routine", async (context) => {
    const pool = await runtimePool(context);
    if (!pool) return;
    try {
      await expect(
        pool.query("SELECT * FROM pkg_users.get_user($1)", [randomUUID()]),
      ).resolves.toMatchObject({ rows: [] });
    } finally {
      await pool.end();
    }
  });
});
