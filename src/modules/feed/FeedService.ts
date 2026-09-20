import { loadConfig } from "../../config/env.js";
import type { Post, TimelinePage } from "../../contracts/models.js";
import { FeedRepository, type FeedDataSource } from "./FeedRepository.js";
import { encodeFeedCursor, type FeedCursor } from "./feed.cursor.js";
import { TimelineRepository, type TimelineReader } from "./TimelineRepository.js";

const MAX_CANDIDATES = 100;

function comparePostsDescending(left: Post, right: Post): number {
  const timeDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  return timeDifference === 0 ? right.id.localeCompare(left.id) : timeDifference;
}

function isBeforeCursor(post: Post, cursor: FeedCursor): boolean {
  const postTime = Date.parse(post.createdAt);
  const cursorTime = Date.parse(cursor.createdAt);
  return (
    postTime < cursorTime || (postTime === cursorTime && post.id.localeCompare(cursor.postId) < 0)
  );
}

function fallbackBefore(cursor?: FeedCursor): string | undefined {
  if (!cursor) return undefined;
  // pkg_posts uses a strict timestamp boundary. Advancing one millisecond lets us
  // retain equal-timestamp rows and apply the stable (createdAt, postId) keyset here.
  return new Date(Date.parse(cursor.createdAt) + 1).toISOString();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Reads Redis first and degrades to pkg_posts.get_recent_posts when Redis is
 * unavailable. Every candidate is revalidated against PostgreSQL and the
 * viewer's current follow set, so deleted posts and stale unfollow entries never
 * escape a materialized timeline.
 */
export class FeedService {
  constructor(
    private readonly timelines: TimelineReader = new TimelineRepository(),
    private readonly feed: FeedDataSource = new FeedRepository(),
    private readonly celebrityThreshold: number = loadConfig().CELEBRITY_THRESHOLD,
  ) {
    if (!Number.isSafeInteger(celebrityThreshold) || celebrityThreshold <= 0) {
      throw new Error("celebrityThreshold must be a positive integer");
    }
  }

  async timeline(userId: string, limit: number, cursor?: FeedCursor): Promise<TimelinePage> {
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 50) {
      throw new Error("limit must be an integer between 1 and 50");
    }

    const followed = await this.feed.following(userId);
    if (followed.length === 0) return { items: [], nextCursor: null };

    const followedIds = unique(followed.map(({ id }) => id));
    const followedSet = new Set(followedIds);
    const celebrities = await this.feed.celebrityFollowing(userId, this.celebrityThreshold);
    const celebrityIds = unique(
      celebrities.map(({ id }) => id).filter((id) => followedSet.has(id)),
    );
    const maxScore = cursor ? Date.parse(cursor.createdAt) : undefined;
    const candidateLimit = Math.min(MAX_CANDIDATES, Math.max(limit + 1, limit * 4));

    let candidateIds: string[];
    try {
      const [precomputed, celebrityStreams] = await Promise.all([
        this.timelines.precomputedPostIds(userId, candidateLimit, maxScore),
        this.timelines.authorPostIds(celebrityIds, candidateLimit, maxScore),
      ]);
      candidateIds = unique([...precomputed, ...celebrityStreams]);
    } catch {
      const fallback = await this.feed.recentPosts(
        followedIds,
        MAX_CANDIDATES,
        fallbackBefore(cursor),
      );
      candidateIds = unique(fallback.map(({ id }) => id));
    }

    const validated = await this.feed.validatePostIds(candidateIds);
    const deduplicated = new Map<string, Post>();
    for (const post of validated) {
      if (!followedSet.has(post.authorId)) continue;
      if (cursor && !isBeforeCursor(post, cursor)) continue;
      deduplicated.set(post.id, post);
    }

    const ordered = [...deduplicated.values()].sort(comparePostsDescending);
    const hasNextPage = ordered.length > limit;
    const items = ordered.slice(0, limit);
    const last = items.at(-1);

    return {
      items,
      nextCursor:
        hasNextPage && last
          ? encodeFeedCursor({ createdAt: last.createdAt, postId: last.id })
          : null,
    };
  }
}
