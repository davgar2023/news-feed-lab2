import { describe, expect, it } from "vitest";

import { TimelineRepository } from "./TimelineRepository.js";

class FakeRedis {
  readonly timelineCalls: unknown[][] = [];
  readonly authorCalls: unknown[][] = [];

  async getTimeline(userId: string, limit: number, maxScore: number | string): Promise<string[]> {
    this.timelineCalls.push([userId, limit, maxScore]);
    return ["timeline-post"];
  }

  async getAuthorPosts(
    authorId: string,
    limit: number,
    maxScore: number | string,
  ): Promise<string[]> {
    this.authorCalls.push([authorId, limit, maxScore]);
    return [`post-${authorId}`];
  }
}

describe("TimelineRepository", () => {
  it("encapsulates precomputed timeline reads", async () => {
    const redis = new FakeRedis();
    const repository = new TimelineRepository(redis);

    await expect(repository.precomputedPostIds("viewer", 20, 123)).resolves.toEqual([
      "timeline-post",
    ]);
    expect(redis.timelineCalls).toEqual([["viewer", 20, 123]]);
  });

  it("combines celebrity author streams through RedisService", async () => {
    const redis = new FakeRedis();
    const repository = new TimelineRepository(redis);

    await expect(repository.authorPostIds(["a", "b"], 10)).resolves.toEqual(["post-a", "post-b"]);
    expect(redis.authorCalls).toEqual([
      ["a", 10, "+inf"],
      ["b", 10, "+inf"],
    ]);
  });
});
