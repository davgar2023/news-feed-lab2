import { describe, expect, it } from "vitest";

import type { Post, User } from "../../contracts/models.js";
import type { FeedDataSource } from "./FeedRepository.js";
import { decodeFeedCursor, type FeedCursor } from "./feed.cursor.js";
import { FeedService } from "./FeedService.js";
import type { TimelineReader } from "./TimelineRepository.js";

const viewerId = "00000000-0000-4000-8000-000000000001";
const normalId = "10000000-0000-4000-8000-000000000001";
const celebrityId = "20000000-0000-4000-8000-000000000001";
const staleId = "30000000-0000-4000-8000-000000000001";

function user(id: string): User {
  return { id, username: `user-${id[0]}`, displayName: id, createdAt: "2026-09-01T00:00:00.000Z" };
}

function post(id: string, authorId: string, createdAt: string): Post {
  return { id, authorId, content: id, createdAt };
}

class FakeTimeline implements TimelineReader {
  precomputed: string[] = [];
  authors: string[] = [];
  error: Error | undefined;
  readonly calls: Array<{ kind: "timeline" | "authors"; ids?: readonly string[]; max?: number }> =
    [];

  async precomputedPostIds(_userId: string, _limit: number, max?: number): Promise<string[]> {
    this.calls.push({ kind: "timeline", max });
    if (this.error) throw this.error;
    return this.precomputed;
  }

  async authorPostIds(ids: readonly string[], _limit: number, max?: number): Promise<string[]> {
    this.calls.push({ kind: "authors", ids, max });
    if (this.error) throw this.error;
    return this.authors;
  }
}

class FakeFeed implements FeedDataSource {
  followed: User[] = [user(normalId), user(celebrityId)];
  celebrities: User[] = [user(celebrityId)];
  posts = new Map<string, Post>();
  fallback: Post[] = [];
  fallbackError: Error | undefined;
  validatedIds: readonly string[] = [];
  recentCall: { authorIds: readonly string[]; limit: number; before?: string } | undefined;

  async following(): Promise<User[]> {
    return this.followed;
  }

  async celebrityFollowing(): Promise<User[]> {
    return this.celebrities;
  }

  async recentPosts(authorIds: readonly string[], limit: number, before?: string): Promise<Post[]> {
    this.recentCall = { authorIds, limit, before };
    if (this.fallbackError) throw this.fallbackError;
    return this.fallback;
  }

  async validatePostIds(postIds: readonly string[]): Promise<Post[]> {
    this.validatedIds = postIds;
    return postIds.flatMap((id) => {
      const found = this.posts.get(id);
      return found ? [found] : [];
    });
  }
}

function setup() {
  const timelines = new FakeTimeline();
  const feed = new FakeFeed();
  return { timelines, feed, service: new FeedService(timelines, feed, 5) };
}

describe("FeedService", () => {
  it("returns a normal precomputed timeline", async () => {
    const { timelines, feed, service } = setup();
    const item = post("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", normalId, "2026-09-15T12:00:00.000Z");
    timelines.precomputed = [item.id];
    feed.posts.set(item.id, item);

    await expect(service.timeline(viewerId, 10)).resolves.toEqual({
      items: [item],
      nextCursor: null,
    });
  });

  it("reads followed celebrity posts on demand", async () => {
    const { timelines, feed, service } = setup();
    const item = post(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      celebrityId,
      "2026-09-15T13:00:00.000Z",
    );
    timelines.authors = [item.id];
    feed.posts.set(item.id, item);

    const page = await service.timeline(viewerId, 10);

    expect(page.items).toEqual([item]);
    expect(timelines.calls.find(({ kind }) => kind === "authors")?.ids).toEqual([celebrityId]);
  });

  it("merges both sources, deduplicates and sorts by timestamp DESC", async () => {
    const { timelines, feed, service } = setup();
    const older = post(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      normalId,
      "2026-09-15T10:00:00.000Z",
    );
    const newer = post(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      celebrityId,
      "2026-09-15T12:00:00.000Z",
    );
    timelines.precomputed = [older.id, newer.id];
    timelines.authors = [newer.id];
    feed.posts.set(older.id, older);
    feed.posts.set(newer.id, newer);

    const page = await service.timeline(viewerId, 10);

    expect(feed.validatedIds).toEqual([older.id, newer.id]);
    expect(page.items).toEqual([newer, older]);
  });

  it("uses post ID as a deterministic DESC tie breaker", async () => {
    const { timelines, feed, service } = setup();
    const low = post("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", normalId, "2026-09-15T12:00:00.000Z");
    const high = post("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", normalId, low.createdAt);
    timelines.precomputed = [low.id, high.id];
    feed.posts.set(low.id, low);
    feed.posts.set(high.id, high);

    expect((await service.timeline(viewerId, 10)).items).toEqual([high, low]);
  });

  it("paginates with a stable compound cursor", async () => {
    const { timelines, feed, service } = setup();
    const ids = [
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ];
    for (const id of ids) feed.posts.set(id, post(id, normalId, "2026-09-15T12:00:00.000Z"));
    timelines.precomputed = ids;

    const first = await service.timeline(viewerId, 2);
    expect(first.items.map(({ id }) => id)).toEqual(ids.slice(0, 2));
    expect(first.nextCursor).not.toBeNull();

    const cursor = decodeFeedCursor(first.nextCursor!);
    const second = await service.timeline(viewerId, 2, cursor);
    expect(second.items.map(({ id }) => id)).toEqual([ids[2]]);
    expect(timelines.calls.at(-2)?.max).toBe(Date.parse(cursor.createdAt));
  });

  it("returns an empty page without reading Redis when there are no follows", async () => {
    const { timelines, feed, service } = setup();
    feed.followed = [];
    feed.celebrities = [];

    await expect(service.timeline(viewerId, 10)).resolves.toEqual({ items: [], nextCursor: null });
    expect(timelines.calls).toEqual([]);
  });

  it("excludes valid posts from users the viewer does not follow", async () => {
    const { timelines, feed, service } = setup();
    const stale = post("dddddddd-dddd-4ddd-8ddd-dddddddddddd", staleId, "2026-09-15T12:00:00.000Z");
    timelines.precomputed = [stale.id];
    feed.posts.set(stale.id, stale);

    expect((await service.timeline(viewerId, 10)).items).toEqual([]);
  });

  it("filters stale materialized entries after an unfollow", async () => {
    const { timelines, feed, service } = setup();
    const retained = post(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      normalId,
      "2026-09-15T11:00:00.000Z",
    );
    const unfollowed = post(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      celebrityId,
      "2026-09-15T12:00:00.000Z",
    );
    feed.followed = [user(normalId)];
    feed.celebrities = [user(celebrityId)];
    timelines.precomputed = [retained.id, unfollowed.id];
    feed.posts.set(retained.id, retained);
    feed.posts.set(unfollowed.id, unfollowed);

    expect((await service.timeline(viewerId, 10)).items).toEqual([retained]);
    expect(timelines.calls.find(({ kind }) => kind === "authors")?.ids).toEqual([]);
  });

  it("drops deleted IDs when pkg_feed validation returns no post", async () => {
    const { timelines, service } = setup();
    timelines.precomputed = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"];

    expect((await service.timeline(viewerId, 10)).items).toEqual([]);
  });

  it("degrades explicitly to pkg_posts for all followed authors on Redis failure", async () => {
    const { timelines, feed, service } = setup();
    const fallback = post(
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      normalId,
      "2026-09-15T12:00:00.000Z",
    );
    timelines.error = new Error("Redis unavailable");
    feed.fallback = [fallback];
    feed.posts.set(fallback.id, fallback);
    const cursor: FeedCursor = {
      createdAt: "2026-09-15T13:00:00.000Z",
      postId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    };

    expect((await service.timeline(viewerId, 10, cursor)).items).toEqual([fallback]);
    expect(feed.recentCall).toEqual({
      authorIds: [normalId, celebrityId],
      limit: 100,
      before: "2026-09-15T13:00:00.001Z",
    });
    expect(feed.validatedIds).toEqual([fallback.id]);
  });
});
