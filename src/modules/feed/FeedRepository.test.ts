import { describe, expect, it } from "vitest";

import { DATABASE_ROUTINES } from "../../contracts/database.js";
import type { ApprovedRoutine, RoutineExecutor } from "../../infrastructure/database/Database.js";
import { FeedRepository } from "./FeedRepository.js";

class FakeDatabase implements RoutineExecutor {
  readonly calls: Array<{ routine: ApprovedRoutine; parameters: readonly unknown[] }> = [];

  constructor(private readonly results: unknown[][]) {}

  async callFunction<Row>(
    routine: ApprovedRoutine,
    parameters: readonly unknown[] = [],
  ): Promise<Row[]> {
    this.calls.push({ routine, parameters });
    return (this.results.shift() ?? []) as Row[];
  }

  async callProcedure(): Promise<void> {
    throw new Error("FeedRepository must only invoke package functions");
  }
}

const createdAt = "2026-09-15T12:00:00.000Z";
const userRow = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "alice",
  display_name: "Alice",
  created_at: new Date(createdAt),
};
const postRow = {
  id: "22222222-2222-4222-8222-222222222222",
  author_id: userRow.id,
  content: "hello",
  created_at: createdAt,
};

describe("FeedRepository", () => {
  it("uses pkg_users for current following and celebrity relationships", async () => {
    const database = new FakeDatabase([[userRow], [userRow]]);
    const repository = new FeedRepository(database);

    await expect(repository.following("viewer")).resolves.toEqual([
      { id: userRow.id, username: "alice", displayName: "Alice", createdAt },
    ]);
    await repository.celebrityFollowing("viewer", 5);

    expect(database.calls).toEqual([
      { routine: DATABASE_ROUTINES.users.getFollowing, parameters: ["viewer"] },
      {
        routine: DATABASE_ROUTINES.users.getCelebrityFollowing,
        parameters: ["viewer", 5],
      },
    ]);
  });

  it("uses pkg_posts for the explicit Redis outage fallback", async () => {
    const database = new FakeDatabase([[postRow]]);
    const repository = new FeedRepository(database);

    await expect(repository.recentPosts([userRow.id], 100, createdAt)).resolves.toEqual([
      {
        id: postRow.id,
        authorId: userRow.id,
        content: "hello",
        createdAt,
      },
    ]);
    expect(database.calls[0]).toEqual({
      routine: DATABASE_ROUTINES.posts.getRecentPosts,
      parameters: [[userRow.id], 100, createdAt],
    });
  });

  it("validates candidate IDs only through pkg_feed and avoids empty calls", async () => {
    const database = new FakeDatabase([[postRow]]);
    const repository = new FeedRepository(database);

    await expect(repository.validatePostIds([postRow.id])).resolves.toHaveLength(1);
    await expect(repository.validatePostIds([])).resolves.toEqual([]);
    expect(database.calls).toEqual([
      {
        routine: DATABASE_ROUTINES.feed.validateFeedItems,
        parameters: [[postRow.id]],
      },
    ]);
  });
});
