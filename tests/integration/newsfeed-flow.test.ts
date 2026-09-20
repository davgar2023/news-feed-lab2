import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { describe, expect, it, type TestContext } from "vitest";

import { EVENT_TYPES, type DomainEvent } from "../../src/contracts/events.js";
import { database, closePool, initializePool } from "../../src/infrastructure/database/Database.js";
import { RabbitMQConnection } from "../../src/infrastructure/messaging/RabbitMQConnection.js";
import { RedisService } from "../../src/infrastructure/redis/RedisService.js";
import { FeedRepository } from "../../src/modules/feed/FeedRepository.js";
import { FeedService } from "../../src/modules/feed/FeedService.js";
import { TimelineRepository } from "../../src/modules/feed/TimelineRepository.js";
import { PostRepository } from "../../src/modules/posts/PostRepository.js";
import { UserRepository } from "../../src/modules/users/UserRepository.js";
import { FanoutWorker } from "../../src/workers/fanoutWorker.js";

interface Infrastructure {
  databaseUrl: string;
  redisUrl: string;
  rabbitUrl: string;
}

async function requireInfrastructure(context: TestContext): Promise<Infrastructure | undefined> {
  const urls = {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    rabbitUrl: process.env.RABBITMQ_URL,
  };
  const missing = Object.entries(urls)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    context.skip(`integration infrastructure variables missing: ${missing.join(", ")}`);
    return undefined;
  }

  const probe = new Pool({ connectionString: urls.databaseUrl, connectionTimeoutMillis: 1_500 });
  const redis = new RedisService({
    url: urls.redisUrl,
    redisOptions: { connectTimeout: 1_500, maxRetriesPerRequest: 0 },
  });
  const rabbit = new RabbitMQConnection({
    url: urls.rabbitUrl,
    reconnectDelayMs: 100,
  });
  try {
    await probe.query("SELECT 1");
    await redis.connect();
    await rabbit.connect();
  } catch (error) {
    context.skip(
      `PostgreSQL, Redis, or RabbitMQ is unavailable: ${error instanceof Error ? error.message : error}`,
    );
    return undefined;
  } finally {
    await Promise.allSettled([probe.end(), redis.shutdown(), rabbit.close()]);
  }
  return urls as Infrastructure;
}

describe("PostgreSQL → worker → Redis → hybrid feed integration", () => {
  it("creates a followed post, fans it out idempotently, and reads it from the feed", async (context) => {
    const infrastructure = await requireInfrastructure(context);
    if (!infrastructure) return;

    initializePool({ connectionString: infrastructure.databaseUrl });
    const redis = new RedisService({ url: infrastructure.redisUrl, maxTimelineItems: 20 });
    const rabbit = new RabbitMQConnection({ url: infrastructure.rabbitUrl });
    const users = new UserRepository(database);
    const posts = new PostRepository(database);
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);

    try {
      await rabbit.assertTopology();
      const author = await users.create(`author_${suffix}`, "Integration Author");
      const follower = await users.create(`follower_${suffix}`, "Integration Follower");
      await users.follow(follower.id, author.id);
      const post = await posts.create(author.id, `integration post ${suffix}`);
      const event: DomainEvent = {
        eventId: randomUUID(),
        eventType: EVENT_TYPES.postCreated,
        aggregateType: "post",
        aggregateId: post.id,
        occurredAt: post.createdAt,
        payload: { postId: post.id, authorId: author.id, createdAt: post.createdAt },
      };
      const worker = new FanoutWorker({ tryProcess: async () => true }, users, redis, 100_000);

      await worker.handle(event);
      await worker.handle(event);

      const feed = new FeedService(
        new TimelineRepository(redis),
        new FeedRepository(database),
        100_000,
      );
      const page = await feed.timeline(follower.id, 10);
      expect(page.items.map(({ id }) => id)).toContain(post.id);
      expect(await redis.getTimeline(follower.id)).toEqual([post.id]);
    } finally {
      await Promise.allSettled([rabbit.close(), redis.shutdown(), closePool()]);
    }
  }, 20_000);
});
