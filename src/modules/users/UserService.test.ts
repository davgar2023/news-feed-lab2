import { describe, expect, it } from "vitest";

import type { User } from "../../contracts/models.js";
import type { UserRepositoryContract } from "../../contracts/repositories.js";
import { SelfFollowError, UserNotFoundError } from "./user.errors.js";
import { UserService } from "./UserService.js";

const alice: User = {
  id: "d8f991d1-c624-4820-af0c-7be39b7d4c68",
  username: "alice",
  displayName: "Alice",
  createdAt: "2026-09-15T12:00:00.000Z",
};

const bob: User = {
  id: "95c76fdf-c88f-442b-8f94-47a238be01d9",
  username: "bob",
  displayName: "Bob",
  createdAt: "2026-09-15T12:01:00.000Z",
};

class FakeUserRepository implements UserRepositoryContract {
  readonly users = new Map([
    [alice.id, alice],
    [bob.id, bob],
  ]);
  readonly follows: Array<[string, string]> = [];
  readonly unfollows: Array<[string, string]> = [];
  celebrityThreshold: number | undefined;

  async create(username: string, displayName: string): Promise<User> {
    return { ...alice, username, displayName };
  }

  async getById(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async follow(followerId: string, followedId: string): Promise<void> {
    this.follows.push([followerId, followedId]);
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    this.unfollows.push([followerId, followedId]);
  }

  async followers(): Promise<User[]> {
    return [bob];
  }

  async following(): Promise<User[]> {
    return [alice];
  }

  async celebrityFollowing(_userId: string, threshold: number): Promise<User[]> {
    this.celebrityThreshold = threshold;
    return [bob];
  }
}

describe("UserService", () => {
  it("returns a user and reports a missing user", async () => {
    const service = new UserService(new FakeUserRepository());

    await expect(service.getUser(alice.id)).resolves.toEqual(alice);
    await expect(service.getUser(crypto.randomUUID())).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it("rejects self-follow before accessing the repository", async () => {
    const repository = new FakeUserRepository();

    await expect(new UserService(repository).followUser(alice.id, alice.id)).rejects.toBeInstanceOf(
      SelfFollowError,
    );
    expect(repository.follows).toHaveLength(0);
  });

  it("validates both users before following or unfollowing", async () => {
    const repository = new FakeUserRepository();
    const service = new UserService(repository);

    await service.followUser(alice.id, bob.id);
    await service.unfollowUser(alice.id, bob.id);
    expect(repository.follows).toEqual([[alice.id, bob.id]]);
    expect(repository.unfollows).toEqual([[alice.id, bob.id]]);

    const missingId = crypto.randomUUID();
    await expect(service.followUser(alice.id, missingId)).rejects.toBeInstanceOf(UserNotFoundError);
    expect(repository.follows).toHaveLength(1);
  });

  it("delegates list and celebrity queries after validating the user", async () => {
    const repository = new FakeUserRepository();
    const service = new UserService(repository);

    await expect(service.getFollowers(alice.id)).resolves.toEqual([bob]);
    await expect(service.getFollowing(alice.id)).resolves.toEqual([alice]);
    await expect(service.getCelebrityFollowing(alice.id, 5)).resolves.toEqual([bob]);
    expect(repository.celebrityThreshold).toBe(5);
  });
});
