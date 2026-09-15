import * as amqp from "amqplib";
import type { Channel, ChannelModel, ConfirmChannel, ConsumeMessage, Options } from "amqplib";

import { loadConfig } from "../../config/env.js";
import type { DomainEvent } from "../../contracts/events.js";
import { RABBITMQ } from "../../contracts/topology.js";

export type RabbitQueue = (typeof RABBITMQ.queues)[keyof typeof RABBITMQ.queues];
export type RabbitRoutingKey =
  (typeof RABBITMQ.routingKeys)[keyof typeof RABBITMQ.routingKeys] | `dead.${string}`;
export type MessageHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
  message: ConsumeMessage,
) => Promise<void>;

export interface RabbitMQConnectionOptions {
  url?: string;
  prefetch?: number;
  maxRetries?: number;
  reconnectDelayMs?: number;
}

interface ConsumerRegistration {
  queue: RabbitQueue;
  handler: MessageHandler;
  consumerTag?: string;
}

function readRetryCount(message: ConsumeMessage): number {
  const value = message.properties.headers?.["x-retry-count"];
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

export class RabbitMQConnection {
  private readonly url: string;
  private readonly prefetchCount: number;
  private readonly maxRetries: number;
  private readonly reconnectDelayMs: number;
  private connection?: ChannelModel;
  private publisher?: ConfirmChannel;
  private consumerChannel?: Channel;
  private connecting?: Promise<void>;
  private reconnectTimer?: NodeJS.Timeout;
  private closing = false;
  private readonly consumers = new Set<ConsumerRegistration>();

  constructor(options: RabbitMQConnectionOptions = {}) {
    const config = options.url === undefined ? loadConfig() : undefined;
    this.url = options.url ?? config!.RABBITMQ_URL;
    this.prefetchCount = options.prefetch ?? config?.RABBITMQ_PREFETCH ?? 20;
    this.maxRetries = options.maxRetries ?? config?.RABBITMQ_MAX_RETRIES ?? 3;
    this.reconnectDelayMs = options.reconnectDelayMs ?? config?.RABBITMQ_RECONNECT_DELAY_MS ?? 1000;
    if (!Number.isSafeInteger(this.prefetchCount) || this.prefetchCount <= 0) {
      throw new Error("RabbitMQ prefetch must be a positive integer");
    }
    if (!Number.isSafeInteger(this.maxRetries) || this.maxRetries < 0) {
      throw new Error("RabbitMQ maxRetries cannot be negative");
    }
    if (!Number.isSafeInteger(this.reconnectDelayMs) || this.reconnectDelayMs <= 0) {
      throw new Error("RabbitMQ reconnectDelayMs must be a positive integer");
    }
  }

  async connect(): Promise<void> {
    if (this.closing) throw new Error("RabbitMQ connection is closing");
    if (this.connection && this.publisher && this.consumerChannel) return;
    if (!this.connecting) {
      this.connecting = this.open()
        .catch((error: unknown) => {
          this.scheduleReconnect();
          throw error;
        })
        .finally(() => {
          this.connecting = undefined;
        });
    }
    return this.connecting;
  }

  async assertTopology(): Promise<void> {
    await this.connect();
  }

  async publish<T extends DomainEvent>(routingKey: RabbitRoutingKey, event: T): Promise<void> {
    await this.connect();
    await this.publishBuffer(routingKey, Buffer.from(JSON.stringify(event)), {
      contentType: "application/json",
      type: event.eventType,
      messageId: event.eventId,
      timestamp: Date.parse(event.occurredAt) || Date.now(),
    });
  }

  async consume<T extends DomainEvent = DomainEvent>(
    queue: RabbitQueue,
    handler: MessageHandler<T>,
  ): Promise<string> {
    await this.connect();
    const registration: ConsumerRegistration = {
      queue,
      handler: handler as MessageHandler,
    };
    this.consumers.add(registration);
    try {
      await this.startConsumer(registration);
      return registration.consumerTag!;
    } catch (error) {
      this.consumers.delete(registration);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.connection || !this.publisher || !this.consumerChannel || this.closing) return false;
    try {
      const channel = await this.connection.createChannel();
      await channel.checkExchange(RABBITMQ.exchange);
      await channel.close();
      return true;
    } catch {
      return false;
    }
  }

  healthCheck(): Promise<boolean> {
    return this.isHealthy();
  }

  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.connecting?.catch(() => undefined);

    const consumerChannel = this.consumerChannel;
    const publisher = this.publisher;
    const connection = this.connection;
    this.consumerChannel = undefined;
    this.publisher = undefined;
    this.connection = undefined;

    await Promise.allSettled([consumerChannel?.close(), publisher?.close()]);
    if (connection) await connection.close().catch(() => undefined);
  }

  private async open(): Promise<void> {
    const connection = await amqp.connect(this.url);
    const publisher = await connection.createConfirmChannel();
    const consumerChannel = await connection.createChannel();

    connection.on("error", () => undefined);
    publisher.on("error", () => undefined);
    consumerChannel.on("error", () => undefined);
    connection.once("close", () => this.onConnectionClosed(connection));
    publisher.once("close", () => this.onChannelClosed(connection));
    consumerChannel.once("close", () => this.onChannelClosed(connection));

    try {
      if (this.closing) throw new Error("RabbitMQ connection is closing");
      await this.configureTopology(publisher);
      await consumerChannel.prefetch(this.prefetchCount);
      this.connection = connection;
      this.publisher = publisher;
      this.consumerChannel = consumerChannel;
      for (const registration of this.consumers) await this.startConsumer(registration);
    } catch (error) {
      await Promise.allSettled([publisher.close(), consumerChannel.close(), connection.close()]);
      throw error;
    }
  }

  private async configureTopology(channel: Channel): Promise<void> {
    await channel.assertExchange(RABBITMQ.exchange, "topic", { durable: true });
    await channel.assertQueue(RABBITMQ.queues.deadLetter, { durable: true });
    await channel.bindQueue(RABBITMQ.queues.deadLetter, RABBITMQ.exchange, "dead.#");

    const queueOptions = (queue: RabbitQueue): Options.AssertQueue => ({
      durable: true,
      deadLetterExchange: RABBITMQ.exchange,
      deadLetterRoutingKey: `dead.${queue}`,
    });
    await channel.assertQueue(RABBITMQ.queues.fanout, queueOptions(RABBITMQ.queues.fanout));
    await channel.assertQueue(RABBITMQ.queues.cleanup, queueOptions(RABBITMQ.queues.cleanup));
    await channel.assertQueue(RABBITMQ.queues.rebuild, queueOptions(RABBITMQ.queues.rebuild));

    await channel.bindQueue(
      RABBITMQ.queues.fanout,
      RABBITMQ.exchange,
      RABBITMQ.routingKeys.postCreated,
    );
    await channel.bindQueue(
      RABBITMQ.queues.cleanup,
      RABBITMQ.exchange,
      RABBITMQ.routingKeys.userUnfollowed,
    );
    await channel.bindQueue(
      RABBITMQ.queues.rebuild,
      RABBITMQ.exchange,
      RABBITMQ.routingKeys.userFollowed,
    );
    await channel.bindQueue(
      RABBITMQ.queues.rebuild,
      RABBITMQ.exchange,
      RABBITMQ.routingKeys.timelineRebuild,
    );
  }

  private async startConsumer(registration: ConsumerRegistration): Promise<void> {
    const channel = this.consumerChannel;
    if (!channel) throw new Error("RabbitMQ consumer channel is unavailable");
    const reply = await channel.consume(
      registration.queue,
      (message) => {
        if (message) void this.handleMessage(registration, message);
      },
      { noAck: false },
    );
    registration.consumerTag = reply.consumerTag;
  }

  private async handleMessage(
    registration: ConsumerRegistration,
    message: ConsumeMessage,
  ): Promise<void> {
    const channel = this.consumerChannel;
    if (!channel) return;

    try {
      const event = JSON.parse(message.content.toString("utf8")) as DomainEvent;
      await registration.handler(event, message);
      channel.ack(message);
    } catch (error) {
      const retryCount = readRetryCount(message);
      const headers = {
        ...message.properties.headers,
        "x-retry-count": retryCount + 1,
        "x-last-error": error instanceof Error ? error.message : String(error),
      };
      const routingKey =
        retryCount < this.maxRetries
          ? (message.fields.routingKey as RabbitRoutingKey)
          : (`dead.${registration.queue}` as const);

      try {
        await this.publishBuffer(routingKey, message.content, {
          contentType: message.properties.contentType,
          contentEncoding: message.properties.contentEncoding,
          correlationId: message.properties.correlationId,
          messageId: message.properties.messageId,
          type: message.properties.type,
          timestamp: message.properties.timestamp,
          headers,
        });
        channel.ack(message);
      } catch {
        channel.nack(message, false, true);
      }
    }
  }

  private async publishBuffer(
    routingKey: string,
    content: Buffer,
    properties: Options.Publish,
  ): Promise<void> {
    const channel = this.publisher;
    if (!channel) throw new Error("RabbitMQ publisher channel is unavailable");
    channel.publish(RABBITMQ.exchange, routingKey, content, {
      ...properties,
      persistent: true,
      deliveryMode: 2,
    });
    await channel.waitForConfirms();
  }

  private onConnectionClosed(closedConnection: ChannelModel): void {
    if (this.connection !== closedConnection) return;
    this.connection = undefined;
    this.publisher = undefined;
    this.consumerChannel = undefined;
    for (const registration of this.consumers) registration.consumerTag = undefined;
    this.scheduleReconnect();
  }

  private onChannelClosed(connection: ChannelModel): void {
    if (this.closing || this.connection !== connection) return;
    void connection.close().catch(() => undefined);
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch(() => this.scheduleReconnect());
    }, this.reconnectDelayMs);
    this.reconnectTimer.unref();
  }
}

export function createRabbitMQConnection(
  options: RabbitMQConnectionOptions = {},
): RabbitMQConnection {
  return new RabbitMQConnection(options);
}
