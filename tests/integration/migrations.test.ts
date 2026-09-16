import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it, type TestContext } from "vitest";

const execute = promisify(execFile);
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
    const script = path.resolve("database/scripts/migrate.sh");
    const environment = { ...process.env, DATABASE_ADMIN_URL: migrationUrl };

    const first = await execute("sh", [script], { env: environment });
    const second = await execute("sh", [script], { env: environment });

    expect(first.stdout).toContain("Applying 001_roles.sql");
    expect(second.stdout).toContain("Applying 007_runtime_permissions.sql");
  }, 30_000);
});
