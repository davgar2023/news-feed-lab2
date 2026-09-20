import { DATABASE_ROUTINES } from "../../contracts/database.js";
import type { Post, User } from "../../contracts/models.js";
import {
  database as defaultDatabase,
  type RoutineExecutor,
} from "../../infrastructure/database/Database.js";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  created_at: Date | string;
}

interface PostRow {
  id: string;
  author_id: string;
  content: string;
  created_at: Date | string;
}

export interface FeedDataSource {
  following(userId: string): Promise<User[]>;
  celebrityFollowing(userId: string, threshold: number): Promise<User[]>;
  recentPosts(authorIds: readonly string[], limit: number, before?: string): Promise<Post[]>;
  validatePostIds(postIds: readonly string[]): Promise<Post[]>;
}

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function user(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    createdAt: timestamp(row.created_at),
  };
}

function post(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    createdAt: timestamp(row.created_at),
  };
}

/** Database access is intentionally restricted to the three feed-related packages. */
export class FeedRepository implements FeedDataSource {
  constructor(private readonly database: RoutineExecutor = defaultDatabase) {}

  async following(userId: string): Promise<User[]> {
    const rows = await this.database.callFunction<UserRow>(DATABASE_ROUTINES.users.getFollowing, [
      userId,
    ]);
    return rows.map(user);
  }

  async celebrityFollowing(userId: string, threshold: number): Promise<User[]> {
    const rows = await this.database.callFunction<UserRow>(
      DATABASE_ROUTINES.users.getCelebrityFollowing,
      [userId, threshold],
    );
    return rows.map(user);
  }

  async recentPosts(authorIds: readonly string[], limit: number, before?: string): Promise<Post[]> {
    const rows = await this.database.callFunction<PostRow>(DATABASE_ROUTINES.posts.getRecentPosts, [
      [...authorIds],
      limit,
      before ?? null,
    ]);
    return rows.map(post);
  }

  async validatePostIds(postIds: readonly string[]): Promise<Post[]> {
    if (postIds.length === 0) return [];
    const rows = await this.database.callFunction<PostRow>(
      DATABASE_ROUTINES.feed.validateFeedItems,
      [[...postIds]],
    );
    return rows.map(post);
  }
}
