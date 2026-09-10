import type { DomainEvent } from "./events.js";
import type { Post, User } from "./models.js";

export interface UserRepositoryContract {
  create(username: string, displayName: string): Promise<User>;
  getById(userId: string): Promise<User | null>;
  follow(followerId: string, followedId: string): Promise<void>;
  unfollow(followerId: string, followedId: string): Promise<void>;
  followers(userId: string): Promise<User[]>;
  following(userId: string): Promise<User[]>;
  celebrityFollowing(userId: string, threshold: number): Promise<User[]>;
}

export interface PostRepositoryContract {
  create(authorId: string, content: string): Promise<Post>;
  getById(postId: string): Promise<Post | null>;
  byUser(userId: string, limit: number, before?: string): Promise<Post[]>;
  recentByAuthors(authorIds: string[], limit: number, before?: string): Promise<Post[]>;
  delete(postId: string, requestingUserId: string): Promise<boolean>;
}

export interface OutboxRepositoryContract {
  pending(limit: number): Promise<DomainEvent[]>;
  markPublished(eventId: string): Promise<void>;
  markFailed(eventId: string, error: string): Promise<void>;
  tryProcess(eventId: string, consumer: string): Promise<boolean>;
}
