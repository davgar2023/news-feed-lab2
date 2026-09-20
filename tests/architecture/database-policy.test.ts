import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanDatabasePolicy } from "../../scripts/verify/database-policy.js";

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "newsfeed-policy-"));
  await Promise.all(
    Object.entries(files).map(async ([name, contents]) => {
      const file = path.join(root, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, contents);
    }),
  );
  return root;
}

describe("database policy scanner", () => {
  it("accepts approved routine calls and ignores tests, database, generated files, and comments", async () => {
    const root = await fixture({
      "src/UserRepository.ts": `
        // SELECT * FROM users is documentation, not executable SQL.
        export const load = (db: { callFunction(name: string): unknown }) =>
          db.callFunction("pkg_users.get_user");
      `,
      "src/generated/client.ts": `export const sql = "SELECT * FROM users";`,
      "src/unsafe.test.ts": `export const sql = "DELETE FROM posts";`,
      "database/helper.ts": `export const pool = new Pool();`,
    });

    await expect(scanDatabasePolicy(root)).resolves.toEqual([]);
  });

  it("reports direct table SQL and Pool construction outside Database", async () => {
    const root = await fixture({
      "src/modules/users/repository.ts": `
        import { Pool as PgPool } from "pg";
        const pool = new PgPool();
        export const sql = \`SELECT * FROM "public"."users" WHERE id = $1\`;
      `,
    });

    const violations = await scanDatabasePolicy(root);
    expect(violations.map(({ rule }) => rule).sort()).toEqual([
      "direct-business-sql",
      "pool-construction",
    ]);
  });

  it("rejects Redis and RabbitMQ access from controllers", async () => {
    const root = await fixture({
      "src/modules/feed/FeedController.ts": `
        import Redis from "ioredis";
        import { RabbitMQConnection } from "../../infrastructure/messaging/RabbitMQConnection.js";
        export const run = (redis: Redis, rabbit: RabbitMQConnection) => {
          redis.zRange("timeline:u1", 0, 1);
          return rabbit.publish("post.created", {});
        };
      `,
    });

    const violations = await scanDatabasePolicy(root);
    expect(violations).toHaveLength(4);
    expect(new Set(violations.map(({ rule }) => rule))).toEqual(
      new Set(["controller-infrastructure-access"]),
    );
  });
});
