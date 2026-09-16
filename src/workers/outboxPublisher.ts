import { loadConfig } from "../config/env.js";
import type { OutboxRepositoryContract } from "../contracts/repositories.js";
import { database } from "../infrastructure/database/Database.js";
import {
  RabbitMQConnection,
  type RabbitRoutingKey,
} from "../infrastructure/messaging/RabbitMQConnection.js";
import { OutboxRepository } from "./OutboxRepository.js";
import { errorMessage, installGracefulShutdown, isMainModule } from "./runtime.js";

export interface EventPublisher {
  publish(
    routingKey: RabbitRoutingKey,
    event: Awaited<ReturnType<OutboxRepositoryContract["pending"]>>[number],
  ): Promise<void>;
}

export interface OutboxPublisherOptions {
  batchSize?: number;
  pollIntervalMs?: number;
}

export class OutboxPublisher {
  private running = false;
  private timer?: NodeJS.Timeout;
  private activePoll?: Promise<void>;

  constructor(
    private readonly outbox: OutboxRepositoryContract,
    private readonly publisher: EventPublisher,
    private readonly options: Required<OutboxPublisherOptions>,
  ) {
    if (!Number.isSafeInteger(options.batchSize) || options.batchSize <= 0) {
      throw new Error("Outbox batchSize must be a positive integer");
    }
    if (!Number.isSafeInteger(options.pollIntervalMs) || options.pollIntervalMs <= 0) {
      throw new Error("Outbox pollIntervalMs must be a positive integer");
    }
  }

  async pollOnce(): Promise<number> {
    const events = await this.outbox.pending(this.options.batchSize);
    for (const event of events) {
      try {
        await this.publisher.publish(event.eventType, event);
        await this.outbox.markPublished(event.eventId);
      } catch (error) {
        await this.outbox.markFailed(event.eventId, errorMessage(error));
      }
    }
    return events.length;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.activePoll;
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      this.activePoll = this.pollOnce()
        .then(() => undefined)
        .catch((error: unknown) => console.error("Outbox polling failed", error))
        .finally(() => {
          this.activePoll = undefined;
          if (this.running) this.schedule(this.options.pollIntervalMs);
        });
    }, delay);
  }
}

export function createOutboxPublisher(
  outbox: OutboxRepositoryContract,
  publisher: EventPublisher,
  options: OutboxPublisherOptions = {},
): OutboxPublisher {
  const config = options.pollIntervalMs === undefined ? loadConfig() : undefined;
  return new OutboxPublisher(outbox, publisher, {
    batchSize: options.batchSize ?? 100,
    pollIntervalMs: options.pollIntervalMs ?? config!.OUTBOX_POLL_INTERVAL_MS,
  });
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const rabbit = new RabbitMQConnection();
  await rabbit.connect();
  const worker = createOutboxPublisher(new OutboxRepository(), rabbit, {
    pollIntervalMs: config.OUTBOX_POLL_INTERVAL_MS,
  });
  worker.start();
  installGracefulShutdown(async () => {
    await worker.stop();
    await rabbit.close();
    await database.closePool();
  });
}

if (isMainModule(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
