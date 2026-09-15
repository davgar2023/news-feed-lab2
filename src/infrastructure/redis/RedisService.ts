import { Redis, type ChainableCommander, type RedisOptions } from "ioredis";

import { loadConfig } from "../../config/env.js";
import { redisKeys } from "../../contracts/topology.js";

export interface TimelineEntry {
  postId: string;
  score: number;
}

export interface RedisServiceOptions {
  url?: string;
  maxTimelineItems?: number;
  redisOptions?: RedisOptions;
  client?: Redis;
}

function parseEntries(values: string[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const postId = values[index];
    const score = Number(values[index + 1]);
    if (postId !== undefined && Number.isFinite(score)) entries.push({ postId, score });
  }
  return entries;
}

export class RedisService {
  private readonly redis: Redis;
  private readonly maxTimelineItems: number;
  private stopped = false;

  constructor(options: RedisServiceOptions = {}) {
    const config =
      options.client === undefined && options.url === undefined ? loadConfig() : undefined;
    this.maxTimelineItems = options.maxTimelineItems ?? config?.TIMELINE_MAX_ITEMS ?? 1000;

    if (!Number.isSafeInteger(this.maxTimelineItems) || this.maxTimelineItems <= 0) {
      throw new Error("maxTimelineItems must be a positive integer");
    }

    this.redis =
      options.client ??
      new Redis(options.url ?? config!.REDIS_URL, {
        lazyConnect: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: config?.REDIS_MAX_RETRIES_PER_REQUEST ?? 3,
        ...options.redisOptions,
      });
    this.redis.on("error", () => undefined);
  }

  getClient(): Redis {
    return this.redis;
  }

  async connect(): Promise<void> {
    if (this.stopped) throw new Error("Redis service has been shut down");
    if (this.redis.status === "wait" || this.redis.status === "end") await this.redis.connect();
  }

  async addToTimeline(userId: string, postId: string, score: number): Promise<void> {
    await this.addAndTrim(redisKeys.timeline(userId), postId, score);
  }

  async addToAuthorPosts(authorId: string, postId: string, score: number): Promise<void> {
    await this.addAndTrim(redisKeys.authorPosts(authorId), postId, score);
  }

  async fanOutPost(userIds: readonly string[], postId: string, score: number): Promise<void> {
    if (userIds.length === 0) return;
    const pipeline = this.redis.pipeline();
    for (const userId of new Set(userIds)) {
      const key = redisKeys.timeline(userId);
      pipeline.zadd(key, score, postId);
      pipeline.zremrangebyrank(key, 0, -(this.maxTimelineItems + 1));
    }
    await this.exec(pipeline);
  }

  async getTimeline(
    userId: string,
    limit = 50,
    maxScore: number | string = "+inf",
  ): Promise<string[]> {
    this.assertLimit(limit);
    return this.redis.zrevrangebyscore(
      redisKeys.timeline(userId),
      maxScore,
      "-inf",
      "LIMIT",
      0,
      limit,
    );
  }

  async getTimelineEntries(userId: string, offset = 0, limit = 50): Promise<TimelineEntry[]> {
    return this.readSortedSet(redisKeys.timeline(userId), offset, limit);
  }

  async getAuthorPosts(
    authorId: string,
    limit = 50,
    maxScore: number | string = "+inf",
  ): Promise<string[]> {
    this.assertLimit(limit);
    return this.redis.zrevrangebyscore(
      redisKeys.authorPosts(authorId),
      maxScore,
      "-inf",
      "LIMIT",
      0,
      limit,
    );
  }

  async removeFromTimeline(userId: string, postIds: readonly string[]): Promise<number> {
    if (postIds.length === 0) return 0;
    return this.redis.zrem(redisKeys.timeline(userId), ...postIds);
  }

  async removePost(key: string, postId: string): Promise<number> {
    return this.redis.zrem(key, postId);
  }

  async trimTimeline(userId: string): Promise<number> {
    return this.redis.zremrangebyrank(redisKeys.timeline(userId), 0, -(this.maxTimelineItems + 1));
  }

  pipeline(): ChainableCommander {
    return this.redis.pipeline();
  }

  async exec(pipeline: ChainableCommander): Promise<unknown> {
    const results = await pipeline.exec();
    if (!results) throw new Error("Redis pipeline was not executed");
    for (const [error] of results) {
      if (error) throw error;
    }
    return results;
  }

  async removeFromTimelines(userIds: readonly string[], postIds: readonly string[]): Promise<void> {
    if (userIds.length === 0 || postIds.length === 0) return;
    const pipeline = this.redis.pipeline();
    for (const userId of new Set(userIds)) {
      pipeline.zrem(redisKeys.timeline(userId), ...postIds);
    }
    await this.exec(pipeline);
  }

  async replaceTimeline(userId: string, entries: readonly TimelineEntry[]): Promise<void> {
    const key = redisKeys.timeline(userId);
    const pipeline = this.redis.pipeline();
    pipeline.del(key);
    if (entries.length > 0) {
      const values = entries.flatMap(({ score, postId }) => [score, postId]);
      pipeline.zadd(key, ...values);
      pipeline.zremrangebyrank(key, 0, -(this.maxTimelineItems + 1));
    }
    await this.exec(pipeline);
  }

  async healthCheck(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.redis.status === "end") return;
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect(false);
    }
  }

  private async addAndTrim(key: string, postId: string, score: number): Promise<void> {
    if (!Number.isFinite(score)) throw new Error("Sorted-set score must be finite");
    const pipeline = this.redis.pipeline();
    pipeline.zadd(key, score, postId);
    pipeline.zremrangebyrank(key, 0, -(this.maxTimelineItems + 1));
    await this.exec(pipeline);
  }

  private async readSortedSet(
    key: string,
    offset: number,
    limit: number,
  ): Promise<TimelineEntry[]> {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("offset cannot be negative");
    this.assertLimit(limit);
    const values = await this.redis.zrevrange(key, offset, offset + limit - 1, "WITHSCORES");
    return parseEntries(values as string[]);
  }

  private assertLimit(limit: number): void {
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("limit must be positive");
  }
}

export function createRedisService(options: RedisServiceOptions = {}): RedisService {
  return new RedisService(options);
}
