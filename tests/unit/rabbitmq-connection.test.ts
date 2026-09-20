import { beforeEach, describe, expect, it, vi } from "vitest";

const rabbitState = vi.hoisted(() => ({
  publisher: undefined as
    | {
        assertExchange: ReturnType<typeof vi.fn>;
        assertQueue: ReturnType<typeof vi.fn>;
        bindQueue: ReturnType<typeof vi.fn>;
        publish: ReturnType<typeof vi.fn>;
        waitForConfirms: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
        on: ReturnType<typeof vi.fn>;
        once: ReturnType<typeof vi.fn>;
      }
    | undefined,
  consumer: undefined as
    | {
        prefetch: ReturnType<typeof vi.fn>;
        consume: ReturnType<typeof vi.fn>;
        ack: ReturnType<typeof vi.fn>;
        nack: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
        on: ReturnType<typeof vi.fn>;
        once: ReturnType<typeof vi.fn>;
        callback?: (message: unknown) => void;
      }
    | undefined,
  connection: undefined as
    | {
        createConfirmChannel: ReturnType<typeof vi.fn>;
        createChannel: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
        on: ReturnType<typeof vi.fn>;
        once: ReturnType<typeof vi.fn>;
      }
    | undefined,
}));

vi.mock("amqplib", () => ({
  connect: vi.fn(async () => rabbitState.connection),
}));

import { EVENT_TYPES } from "../../src/contracts/events.js";
import { RABBITMQ } from "../../src/contracts/topology.js";
import { RabbitMQConnection } from "../../src/infrastructure/messaging/RabbitMQConnection.js";

function channelEvents() {
  return { on: vi.fn(), once: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
}

function resetRabbit(): void {
  rabbitState.publisher = {
    ...channelEvents(),
    assertExchange: vi.fn().mockResolvedValue({}),
    assertQueue: vi.fn().mockResolvedValue({}),
    bindQueue: vi.fn().mockResolvedValue({}),
    publish: vi.fn().mockReturnValue(true),
    waitForConfirms: vi.fn().mockResolvedValue(undefined),
  };
  rabbitState.consumer = {
    ...channelEvents(),
    prefetch: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn(async (_queue: string, callback: (message: unknown) => void) => {
      rabbitState.consumer!.callback = callback;
      return { consumerTag: "consumer-1" };
    }),
    ack: vi.fn(),
    nack: vi.fn(),
  };
  rabbitState.connection = {
    ...channelEvents(),
    createConfirmChannel: vi.fn(async () => rabbitState.publisher),
    createChannel: vi.fn(async () => rabbitState.consumer),
  };
}

function message(retryCount: number) {
  return {
    content: Buffer.from("{}"),
    fields: { routingKey: RABBITMQ.routingKeys.postCreated },
    properties: {
      headers: { "x-retry-count": retryCount },
      contentType: "application/json",
      messageId: "event-1",
      type: EVENT_TYPES.postCreated,
    },
  };
}

describe("RabbitMQ topology and failure routing", () => {
  beforeEach(resetRabbit);

  it("declares durable topic topology, DLQ bindings, manual acknowledgements, and prefetch", async () => {
    const rabbit = new RabbitMQConnection({
      url: "amqp://test",
      prefetch: 7,
      reconnectDelayMs: 10,
    });
    await rabbit.connect();

    expect(rabbitState.publisher!.assertExchange).toHaveBeenCalledWith(RABBITMQ.exchange, "topic", {
      durable: true,
    });
    expect(rabbitState.publisher!.assertQueue).toHaveBeenCalledWith(RABBITMQ.queues.deadLetter, {
      durable: true,
    });
    expect(rabbitState.publisher!.bindQueue).toHaveBeenCalledWith(
      RABBITMQ.queues.deadLetter,
      RABBITMQ.exchange,
      "dead.#",
    );
    expect(rabbitState.consumer!.prefetch).toHaveBeenCalledWith(7);

    await rabbit.consume(RABBITMQ.queues.fanout, vi.fn());
    expect(rabbitState.consumer!.consume).toHaveBeenCalledWith(
      RABBITMQ.queues.fanout,
      expect.any(Function),
      { noAck: false },
    );
    await rabbit.close();
  });

  it("republishes failed work with an incremented retry header, then routes it to the DLQ", async () => {
    const rabbit = new RabbitMQConnection({
      url: "amqp://test",
      maxRetries: 1,
      reconnectDelayMs: 10,
    });
    const handler = vi.fn().mockRejectedValue(new Error("worker failed"));
    await rabbit.consume(RABBITMQ.queues.fanout, handler);

    rabbitState.consumer!.callback!(message(0));
    await vi.waitFor(() => expect(rabbitState.consumer!.ack).toHaveBeenCalledTimes(1));
    expect(rabbitState.publisher!.publish).toHaveBeenNthCalledWith(
      1,
      RABBITMQ.exchange,
      RABBITMQ.routingKeys.postCreated,
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        deliveryMode: 2,
        headers: expect.objectContaining({ "x-retry-count": 1 }),
      }),
    );

    rabbitState.consumer!.callback!(message(1));
    await vi.waitFor(() => expect(rabbitState.consumer!.ack).toHaveBeenCalledTimes(2));
    expect(rabbitState.publisher!.publish).toHaveBeenNthCalledWith(
      2,
      RABBITMQ.exchange,
      `dead.${RABBITMQ.queues.fanout}`,
      expect.any(Buffer),
      expect.objectContaining({ headers: expect.objectContaining({ "x-retry-count": 2 }) }),
    );
    expect(rabbitState.consumer!.nack).not.toHaveBeenCalled();
    await rabbit.close();
  });
});
