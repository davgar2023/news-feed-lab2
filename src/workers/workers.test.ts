import { describe, expect, it, vi } from "vitest";

import { DATABASE_ROUTINES } from "../contracts/database.js";
import { EVENT_TYPES, type DomainEvent } from "../contracts/events.js";
import type { Post, User } from "../contracts/models.js";
import type { RoutineExecutor } from "../infrastructure/database/Database.js";
import { CleanupWorker } from "./cleanupWorker.js";
import { FanoutWorker } from "./fanoutWorker.js";
import { OutboxRepository } from "./OutboxRepository.js";
import { OutboxPublisher } from "./outboxPublisher.js";
import { RebuildWorker } from "./rebuildWorker.js";
import { TimelineRebuilder } from "./timelineRebuilder.js";

const timestamp = "2026-01-02T03:04:05.000Z";

function event(eventType: DomainEvent["eventType"], payload: Record<string, unknown>): DomainEvent {
  return {
    eventId: "event-1",
    eventType,
    aggregateType: "test",
    aggregateId: "aggregate-1",
    occurredAt: timestamp,
    payload,
  };
}

function user(id: string): User {
  return { id, username: id, displayName: id, createdAt: timestamp };
}

function post(id: string, authorId = "author-1"): Post {
  return { id, authorId, content: id, createdAt: timestamp };
}

describe("OutboxRepository", () => {
  it("uses only approved pkg_outbox routines and normalizes rows", async () => {
    const callFunction = vi
      .fn<RoutineExecutor["callFunction"]>()
      .mockResolvedValueOnce([
        {
          event_id: "event-1",
          event_type: EVENT_TYPES.postCreated,
          aggregate_type: "post",
          aggregate_id: "post-1",
          payload: { postId: "post-1" },
          created_at: new Date(timestamp),
        },
      ])
      .mockResolvedValueOnce([{ try_process_event: true }]);
    const callProcedure = vi.fn<RoutineExecutor["callProcedure"]>().mockResolvedValue(undefined);
    const repository = new OutboxRepository({
      callFunction: callFunction as RoutineExecutor["callFunction"],
      callProcedure,
    });

    await expect(repository.pending(10)).resolves.toMatchObject([
      { eventId: "event-1", occurredAt: timestamp },
    ]);
    await repository.markPublished("event-1");
    await repository.markFailed("event-1", "offline");
    await expect(repository.tryProcess("event-1", "worker")).resolves.toBe(true);

    expect(callFunction).toHaveBeenNthCalledWith(
      1,
      DATABASE_ROUTINES.outbox.getPendingEvents,
      [10],
    );
    expect(callProcedure).toHaveBeenNthCalledWith(1, DATABASE_ROUTINES.outbox.markPublished, [
      "event-1",
    ]);
    expect(callProcedure).toHaveBeenNthCalledWith(2, DATABASE_ROUTINES.outbox.markFailed, [
      "event-1",
      "offline",
    ]);
  });
});

describe("OutboxPublisher", () => {
  it("marks publish failures for retry and marks successful events published", async () => {
    const item = event(EVENT_TYPES.postCreated, {});
    const outbox = {
      pending: vi.fn().mockResolvedValue([item]),
      markPublished: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      tryProcess: vi.fn(),
    };
    const publish = vi
      .fn()
      .mockRejectedValueOnce(new Error("RabbitMQ unavailable"))
      .mockResolvedValueOnce(undefined);
    const publisher = new OutboxPublisher(
      outbox,
      { publish },
      { batchSize: 20, pollIntervalMs: 10 },
    );

    await publisher.pollOnce();
    expect(outbox.markFailed).toHaveBeenCalledWith("event-1", "RabbitMQ unavailable");
    expect(outbox.markPublished).not.toHaveBeenCalled();

    await publisher.pollOnce();
    expect(outbox.markPublished).toHaveBeenCalledWith("event-1");
    expect(publish).toHaveBeenCalledWith(EVENT_TYPES.postCreated, item);
  });
});

describe("FanoutWorker", () => {
  const created = event(EVENT_TYPES.postCreated, {
    postId: "post-1",
    authorId: "author-1",
    createdAt: timestamp,
  });

  it("fans normal authors out to followers and ignores duplicate delivery", async () => {
    const outbox = { tryProcess: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false) };
    const users = { followers: vi.fn().mockResolvedValue([user("u1"), user("u2")]) };
    const timelines = {
      addToAuthorPosts: vi.fn().mockResolvedValue(undefined),
      fanOutPost: vi.fn().mockResolvedValue(undefined),
    };
    const worker = new FanoutWorker(outbox, users, timelines, 5);

    await worker.handle(created);
    await worker.handle(created);

    expect(timelines.fanOutPost).toHaveBeenCalledOnce();
    expect(timelines.fanOutPost).toHaveBeenCalledWith(
      ["u1", "u2"],
      "post-1",
      Date.parse(timestamp),
    );
    expect(users.followers).toHaveBeenCalledOnce();
  });

  it("stores celebrity posts in the author stream without timeline fanout", async () => {
    const timelines = {
      addToAuthorPosts: vi.fn().mockResolvedValue(undefined),
      fanOutPost: vi.fn().mockResolvedValue(undefined),
    };
    const worker = new FanoutWorker(
      { tryProcess: vi.fn().mockResolvedValue(true) },
      { followers: vi.fn().mockResolvedValue([user("u1"), user("u2")]) },
      timelines,
      2,
    );

    await worker.handle(created);

    expect(timelines.addToAuthorPosts).toHaveBeenCalledWith(
      "author-1",
      "post-1",
      Date.parse(timestamp),
    );
    expect(timelines.fanOutPost).not.toHaveBeenCalled();
  });

  it("propagates Redis failures so RabbitMQ can retry the message", async () => {
    const worker = new FanoutWorker(
      { tryProcess: vi.fn().mockResolvedValue(true) },
      { followers: vi.fn().mockResolvedValue([user("u1")]) },
      {
        addToAuthorPosts: vi.fn(),
        fanOutPost: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
      },
      5,
    );
    await expect(worker.handle(created)).rejects.toThrow("Redis unavailable");
  });
});

describe("CleanupWorker", () => {
  it("removes the unfollowed author's posts and is idempotent", async () => {
    const outbox = { tryProcess: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false) };
    const posts = { byUser: vi.fn().mockResolvedValue([post("p1"), post("p2")]) };
    const timelines = { removeFromTimeline: vi.fn().mockResolvedValue(2) };
    const worker = new CleanupWorker(outbox, posts, timelines, 100);
    const unfollowed = event(EVENT_TYPES.userUnfollowed, {
      followerId: "follower-1",
      followedId: "author-1",
    });

    await worker.handle(unfollowed);
    await worker.handle(unfollowed);

    expect(posts.byUser).toHaveBeenCalledWith("author-1", 100);
    expect(timelines.removeFromTimeline).toHaveBeenCalledOnce();
    expect(timelines.removeFromTimeline).toHaveBeenCalledWith("follower-1", ["p1", "p2"]);
  });
});

describe("RebuildWorker", () => {
  it("rebuilds follow and explicit rebuild events, excluding celebrity authors", async () => {
    const users = {
      following: vi.fn().mockResolvedValue([user("normal"), user("celebrity")]),
      celebrityFollowing: vi.fn().mockResolvedValue([user("celebrity")]),
    };
    const posts = { recentByAuthors: vi.fn().mockResolvedValue([post("p1", "normal")]) };
    const timelines = { replaceTimeline: vi.fn().mockResolvedValue(undefined) };
    const rebuilder = new TimelineRebuilder(users, posts, timelines, {
      celebrityThreshold: 5,
      maxTimelineItems: 100,
    });
    const worker = new RebuildWorker({ tryProcess: vi.fn().mockResolvedValue(true) }, rebuilder);

    await worker.handle(
      event(EVENT_TYPES.userFollowed, { followerId: "follower-1", followedId: "normal" }),
    );
    await worker.handle(event(EVENT_TYPES.timelineRebuild, { userId: "follower-1" }));

    expect(posts.recentByAuthors).toHaveBeenCalledWith(["normal"], 100);
    expect(timelines.replaceTimeline).toHaveBeenCalledWith("follower-1", [
      { postId: "p1", score: Date.parse(timestamp) },
    ]);
    expect(timelines.replaceTimeline).toHaveBeenCalledTimes(2);
  });
});
