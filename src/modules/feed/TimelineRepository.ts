import { RedisService } from "../../infrastructure/redis/RedisService.js";

export interface TimelineReader {
  precomputedPostIds(userId: string, limit: number, maxScore?: number): Promise<string[]>;
  authorPostIds(authorIds: readonly string[], limit: number, maxScore?: number): Promise<string[]>;
}

type TimelineRedis = Pick<RedisService, "getTimeline" | "getAuthorPosts">;

/** Keeps every Redis operation behind the feed's repository boundary. */
export class TimelineRepository implements TimelineReader {
  constructor(private readonly redis: TimelineRedis = new RedisService()) {}

  precomputedPostIds(userId: string, limit: number, maxScore?: number): Promise<string[]> {
    return this.redis.getTimeline(userId, limit, maxScore ?? "+inf");
  }

  async authorPostIds(
    authorIds: readonly string[],
    limit: number,
    maxScore?: number,
  ): Promise<string[]> {
    const streams = await Promise.all(
      authorIds.map((authorId) => this.redis.getAuthorPosts(authorId, limit, maxScore ?? "+inf")),
    );
    return streams.flat();
  }
}
