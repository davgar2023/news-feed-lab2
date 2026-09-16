import { DATABASE_ROUTINES } from "../src/contracts/database.js";
import { closePool, database } from "../src/infrastructure/database/Database.js";

interface SeedResult {
  user_count: number;
  post_count: number;
  follow_count: number;
  celebrity_user_id: string;
}

async function main(): Promise<void> {
  const threshold = Number(process.env.CELEBRITY_THRESHOLD ?? 5);
  if (!Number.isSafeInteger(threshold) || threshold <= 0) {
    throw new Error("CELEBRITY_THRESHOLD must be a positive integer");
  }

  const [result] = await database.callFunction<SeedResult>(
    DATABASE_ROUTINES.seed.generateMockData,
    [threshold],
  );
  if (!result) throw new Error("pkg_lab_seed.generate_mock_data returned no summary");
  console.log(
    `Seed complete: ${result.user_count} users, ${result.post_count} posts, ` +
      `${result.follow_count} follows; celebrity=${result.celebrity_user_id}`,
  );
}

try {
  await main();
} finally {
  await closePool();
}
