import { loadConfig } from "../config/env.js";
import { EVENT_TYPES, type DomainEvent, type FollowChangedPayload } from "../contracts/events.js";
import { RABBITMQ } from "../contracts/topology.js";
import type { OutboxRepositoryContract } from "../contracts/repositories.js";
import { database } from "../infrastructure/database/Database.js";
import { RabbitMQConnection } from "../infrastructure/messaging/RabbitMQConnection.js";
import { RedisService } from "../infrastructure/redis/RedisService.js";
import { PostRepository } from "../modules/posts/PostRepository.js";
import { UserRepository } from "../modules/users/UserRepository.js";
import { OutboxRepository } from "./OutboxRepository.js";
import { installGracefulShutdown, isMainModule, requireString } from "./runtime.js";
import { TimelineRebuilder } from "./timelineRebuilder.js";

const CONSUMER_NAME = "rebuild-worker";

interface TimelineRebuildPayload {
  userId?: string;
}

export class RebuildWorker {
  constructor(
    private readonly outbox: Pick<OutboxRepositoryContract, "tryProcess">,
    private readonly rebuilder: Pick<TimelineRebuilder, "rebuild">,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    let userId: string;
    if (event.eventType === EVENT_TYPES.userFollowed) {
      userId = requireString(
        (event.payload as Partial<FollowChangedPayload>).followerId,
        "followerId",
      );
    } else if (event.eventType === EVENT_TYPES.timelineRebuild) {
      userId = requireString((event.payload as TimelineRebuildPayload).userId, "userId");
    } else {
      throw new Error(`Rebuild worker cannot process ${event.eventType}`);
    }

    if (!(await this.outbox.tryProcess(event.eventId, CONSUMER_NAME))) return;
    await this.rebuilder.rebuild(userId);
  }
}

export function createRebuildWorker(
  outbox: Pick<OutboxRepositoryContract, "tryProcess">,
  rebuilder: Pick<TimelineRebuilder, "rebuild">,
): RebuildWorker {
  return new RebuildWorker(outbox, rebuilder);
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const rabbit = new RabbitMQConnection();
  const redis = new RedisService();
  await Promise.all([rabbit.connect(), redis.connect()]);
  const rebuilder = new TimelineRebuilder(new UserRepository(), new PostRepository(), redis, {
    celebrityThreshold: config.CELEBRITY_THRESHOLD,
    maxTimelineItems: config.TIMELINE_MAX_ITEMS,
  });
  const worker = createRebuildWorker(new OutboxRepository(), rebuilder);
  await rabbit.consume(RABBITMQ.queues.rebuild, (event) => worker.handle(event));
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
