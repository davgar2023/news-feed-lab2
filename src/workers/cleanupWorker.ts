import { loadConfig } from "../config/env.js";
import { EVENT_TYPES, type DomainEvent, type FollowChangedPayload } from "../contracts/events.js";
import { RABBITMQ } from "../contracts/topology.js";
import type {
  OutboxRepositoryContract,
  PostRepositoryContract,
} from "../contracts/repositories.js";
import { database } from "../infrastructure/database/Database.js";
import { RabbitMQConnection } from "../infrastructure/messaging/RabbitMQConnection.js";
import { RedisService } from "../infrastructure/redis/RedisService.js";
import { PostRepository } from "../modules/posts/PostRepository.js";
import { OutboxRepository } from "./OutboxRepository.js";
import { installGracefulShutdown, isMainModule, requireString } from "./runtime.js";

const CONSUMER_NAME = "cleanup-worker";

export interface CleanupTimelineStore {
  removeFromTimeline(userId: string, postIds: readonly string[]): Promise<number>;
}

export class CleanupWorker {
  constructor(
    private readonly outbox: Pick<OutboxRepositoryContract, "tryProcess">,
    private readonly posts: Pick<PostRepositoryContract, "byUser">,
    private readonly timelines: CleanupTimelineStore,
    private readonly maxTimelineItems: number,
  ) {
    if (!Number.isSafeInteger(maxTimelineItems) || maxTimelineItems <= 0) {
      throw new Error("maxTimelineItems must be a positive integer");
    }
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== EVENT_TYPES.userUnfollowed) {
      throw new Error(`Cleanup worker cannot process ${event.eventType}`);
    }
    const payload = event.payload as Partial<FollowChangedPayload>;
    const followerId = requireString(payload.followerId, "followerId");
    const followedId = requireString(payload.followedId, "followedId");
    if (!(await this.outbox.tryProcess(event.eventId, CONSUMER_NAME))) return;

    const posts = await this.posts.byUser(followedId, this.maxTimelineItems);
    await this.timelines.removeFromTimeline(
      followerId,
      posts.map(({ id }) => id),
    );
  }
}

export function createCleanupWorker(
  outbox: Pick<OutboxRepositoryContract, "tryProcess">,
  posts: Pick<PostRepositoryContract, "byUser">,
  timelines: CleanupTimelineStore,
  maxTimelineItems: number,
): CleanupWorker {
  return new CleanupWorker(outbox, posts, timelines, maxTimelineItems);
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const rabbit = new RabbitMQConnection();
  const redis = new RedisService();
  await Promise.all([rabbit.connect(), redis.connect()]);
  const worker = createCleanupWorker(
    new OutboxRepository(),
    new PostRepository(),
    redis,
    config.TIMELINE_MAX_ITEMS,
  );
  await rabbit.consume(RABBITMQ.queues.cleanup, (event) => worker.handle(event));
  installGracefulShutdown(async () => {
    await rabbit.close();
    await redis.shutdown();
    await database.closePool();
  });
}

if (isMainModule(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
