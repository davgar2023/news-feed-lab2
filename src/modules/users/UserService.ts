import type { User } from "../../contracts/models.js";
import type { UserRepositoryContract } from "../../contracts/repositories.js";
import { SelfFollowError, UserNotFoundError } from "./user.errors.js";

export interface UserServiceContract {
  createUser(username: string, displayName: string): Promise<User>;
  getUser(userId: string): Promise<User>;
  followUser(followerId: string, followedId: string): Promise<void>;
  unfollowUser(followerId: string, followedId: string): Promise<void>;
  getFollowers(userId: string): Promise<User[]>;
  getFollowing(userId: string): Promise<User[]>;
  getCelebrityFollowing(userId: string, threshold: number): Promise<User[]>;
}

export class UserService implements UserServiceContract {
  constructor(private readonly users: UserRepositoryContract) {}

  createUser(username: string, displayName: string): Promise<User> {
    return this.users.create(username, displayName);
  }

  async getUser(userId: string): Promise<User> {
    const user = await this.users.getById(userId);
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }

  async followUser(followerId: string, followedId: string): Promise<void> {
    if (followerId === followedId) throw new SelfFollowError();
    await Promise.all([this.getUser(followerId), this.getUser(followedId)]);
    await this.users.follow(followerId, followedId);
  }

  async unfollowUser(followerId: string, followedId: string): Promise<void> {
    await Promise.all([this.getUser(followerId), this.getUser(followedId)]);
    await this.users.unfollow(followerId, followedId);
  }

  async getFollowers(userId: string): Promise<User[]> {
    await this.getUser(userId);
    return this.users.followers(userId);
  }

  async getFollowing(userId: string): Promise<User[]> {
    await this.getUser(userId);
    return this.users.following(userId);
  }

  async getCelebrityFollowing(userId: string, threshold: number): Promise<User[]> {
    await this.getUser(userId);
    return this.users.celebrityFollowing(userId, threshold);
  }
}
