import type { Post } from "../contracts/models.js";
import type { PostRepositoryContract, UserRepositoryContract } from "../contracts/repositories.js";
import type { TimelineEntry } from "../infrastructure/redis/RedisService.js";

export interface TimelineWriter {
  replaceTimeline(userId: string, entries: readonly TimelineEntry[]): Promise<void>;
}

export interface TimelineRebuilderOptions {
  celebrityThreshold: number;
  maxTimelineItems: number;
}

export class TimelineRebuilder {
  constructor(
    private readonly users: Pick<UserRepositoryContract, "following" | "celebrityFollowing">,
    private readonly posts: Pick<PostRepositoryContract, "recentByAuthors">,
    private readonly timelines: TimelineWriter,
    private readonly options: TimelineRebuilderOptions,
  ) {
    if (!Number.isSafeInteger(options.celebrityThreshold) || options.celebrityThreshold <= 0) {
      throw new Error("celebrityThreshold must be a positive integer");
    }
    if (!Number.isSafeInteger(options.maxTimelineItems) || options.maxTimelineItems <= 0) {
      throw new Error("maxTimelineItems must be a positive integer");
    }
  }

  async rebuild(userId: string): Promise<void> {
    const [following, celebrityFollowing] = await Promise.all([
      this.users.following(userId),
      this.users.celebrityFollowing(userId, this.options.celebrityThreshold),
    ]);
    const celebrityIds = new Set(celebrityFollowing.map(({ id }) => id));
    const normalAuthorIds = following
      .map(({ id }) => id)
      .filter((authorId) => !celebrityIds.has(authorId));
    const posts =
      normalAuthorIds.length === 0
        ? []
        : await this.posts.recentByAuthors(normalAuthorIds, this.options.maxTimelineItems);
    await this.timelines.replaceTimeline(userId, posts.map(toTimelineEntry));
  }
}

function toTimelineEntry(post: Post): TimelineEntry {
  const score = Date.parse(post.createdAt);
  if (!Number.isFinite(score)) throw new Error(`Post ${post.id} has an invalid createdAt value`);
  return { postId: post.id, score };
}
