import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";
import { describe, expect, it, type TestContext } from "vitest";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const suiteReason = migrationUrl
  ? ""
  : " (skipped: MIGRATION_DATABASE_URL is not set; use a disposable PostgreSQL database)";

describe(`ordered database migrations${suiteReason}`, () => {
  it("apply successfully and are idempotent on a disposable database", async (context: TestContext) => {
    if (!migrationUrl) {
      context.skip("MIGRATION_DATABASE_URL must target a disposable PostgreSQL database");
      return;
    }
    const migrationsDirectory = path.resolve("database/migrations");
    const migrations = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const pool = new Pool({ connectionString: migrationUrl });

    try {
      for (let pass = 0; pass < 2; pass += 1) {
        for (const migration of migrations) {
          const sql = await readFile(path.join(migrationsDirectory, migration), "utf8");
          const testSql = sql
            .replaceAll(":'newsfeed_owner_password'", "'newsfeed_owner'")
            .replaceAll(":'newsfeed_app_password'", "'newsfeed_app'");
          await pool.query(testSql);
        }
      }
    } finally {
      await pool.end();
    }

    expect(migrations).toEqual([
      "001_roles.sql",
      "002_core_schema.sql",
      "003_users_api.sql",
      "004_posts_feed_api.sql",
      "005_outbox_api.sql",
      "006_lab_seed.sql",
      "007_runtime_permissions.sql",
    ]);
  }, 30_000);
});
