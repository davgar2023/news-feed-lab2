import { loadConfig } from "../config/env.js";
import { EVENT_TYPES, type DomainEvent, type PostCreatedPayload } from "../contracts/events.js";
import { RABBITMQ } from "../contracts/topology.js";
import type {
  OutboxRepositoryContract,
  UserRepositoryContract,
} from "../contracts/repositories.js";
import { database } from "../infrastructure/database/Database.js";
import { RabbitMQConnection } from "../infrastructure/messaging/RabbitMQConnection.js";
import { RedisService } from "../infrastructure/redis/RedisService.js";
import { UserRepository } from "../modules/users/UserRepository.js";
import { OutboxRepository } from "./OutboxRepository.js";
import { installGracefulShutdown, isMainModule, requireString } from "./runtime.js";

const CONSUMER_NAME = "fanout-worker";

export interface FanoutTimelineStore {
  addToAuthorPosts(authorId: string, postId: string, score: number): Promise<void>;
  fanOutPost(userIds: readonly string[], postId: string, score: number): Promise<void>;
}

export class FanoutWorker {
  constructor(
    private readonly outbox: Pick<OutboxRepositoryContract, "tryProcess">,
    private readonly users: Pick<UserRepositoryContract, "followers">,
    private readonly timelines: FanoutTimelineStore,
    private readonly celebrityThreshold: number,
  ) {
    if (!Number.isSafeInteger(celebrityThreshold) || celebrityThreshold <= 0) {
      throw new Error("celebrityThreshold must be a positive integer");
    }
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== EVENT_TYPES.postCreated) {
      throw new Error(`Fanout worker cannot process ${event.eventType}`);
    }
    const payload = event.payload as Partial<PostCreatedPayload>;
    const postId = requireString(payload.postId, "postId");
    const authorId = requireString(payload.authorId, "authorId");
    const createdAt = requireString(payload.createdAt, "createdAt");
    const score = Date.parse(createdAt);
    if (!Number.isFinite(score)) throw new Error("Event payload createdAt must be a timestamp");

    if (!(await this.outbox.tryProcess(event.eventId, CONSUMER_NAME))) return;
    const followers = await this.users.followers(authorId);
    if (followers.length >= this.celebrityThreshold) {
      await this.timelines.addToAuthorPosts(authorId, postId, score);
      return;
    }
    await this.timelines.fanOutPost(
      followers.map(({ id }) => id),
      postId,
      score,
    );
  }
}

export function createFanoutWorker(
  outbox: Pick<OutboxRepositoryContract, "tryProcess">,
  users: Pick<UserRepositoryContract, "followers">,
  timelines: FanoutTimelineStore,
  celebrityThreshold: number,
): FanoutWorker {
  return new FanoutWorker(outbox, users, timelines, celebrityThreshold);
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const rabbit = new RabbitMQConnection();
  const redis = new RedisService();
  await Promise.all([rabbit.connect(), redis.connect()]);
  const worker = createFanoutWorker(
    new OutboxRepository(),
    new UserRepository(),
    redis,
    config.CELEBRITY_THRESHOLD,
  );
  await rabbit.consume(RABBITMQ.queues.fanout, (event) => worker.handle(event));
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
