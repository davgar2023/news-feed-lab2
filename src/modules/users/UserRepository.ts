import { DATABASE_ROUTINES } from "../../contracts/database.js";
import type { User } from "../../contracts/models.js";
import type { UserRepositoryContract } from "../../contracts/repositories.js";
import {
  database as defaultDatabase,
  type RoutineExecutor,
} from "../../infrastructure/database/Database.js";
import {
  FollowAlreadyExistsError,
  FollowNotFoundError,
  SelfFollowError,
  UserNotFoundError,
  UsernameAlreadyExistsError,
} from "./user.errors.js";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  created_at: Date | string;
}

interface PostgreSqlError {
  code?: unknown;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as PostgreSqlError).code;
  return typeof code === "string" ? code : undefined;
}

function normalizeTimestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function normalizeUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    createdAt: normalizeTimestamp(row.created_at),
  };
}

export class UserRepository implements UserRepositoryContract {
  constructor(private readonly database: RoutineExecutor = defaultDatabase) {}

  async create(username: string, displayName: string): Promise<User> {
    try {
      const rows = await this.database.callFunction<UserRow>(DATABASE_ROUTINES.users.createUser, [
        username,
        displayName,
      ]);
      const row = rows[0];
      if (!row) throw new Error("pkg_users.create_user returned no user");
      return normalizeUser(row);
    } catch (error) {
      if (errorCode(error) === "23505") {
        throw new UsernameAlreadyExistsError(username, { cause: error });
      }
      throw error;
    }
  }

  async getById(userId: string): Promise<User | null> {
    const rows = await this.database.callFunction<UserRow>(DATABASE_ROUTINES.users.getUser, [
      userId,
    ]);
    return rows[0] ? normalizeUser(rows[0]) : null;
  }

  async follow(followerId: string, followedId: string): Promise<void> {
    try {
      await this.database.callProcedure(DATABASE_ROUTINES.users.followUser, [
        followerId,
        followedId,
      ]);
    } catch (error) {
      switch (errorCode(error)) {
        case "23514":
          throw new SelfFollowError({ cause: error });
        case "23505":
          throw new FollowAlreadyExistsError({ cause: error });
        case "23503":
          throw new UserNotFoundError(undefined, { cause: error });
        default:
          throw error;
      }
    }
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    try {
      await this.database.callProcedure(DATABASE_ROUTINES.users.unfollowUser, [
        followerId,
        followedId,
      ]);
    } catch (error) {
      if (errorCode(error) === "P0002") {
        throw new FollowNotFoundError({ cause: error });
      }
      throw error;
    }
  }

  async followers(userId: string): Promise<User[]> {
    return this.findUsers(DATABASE_ROUTINES.users.getFollowers, [userId]);
  }

  async following(userId: string): Promise<User[]> {
    return this.findUsers(DATABASE_ROUTINES.users.getFollowing, [userId]);
  }

  async celebrityFollowing(userId: string, threshold: number): Promise<User[]> {
    return this.findUsers(DATABASE_ROUTINES.users.getCelebrityFollowing, [userId, threshold]);
  }

  private async findUsers(
    routine:
      | typeof DATABASE_ROUTINES.users.getFollowers
      | typeof DATABASE_ROUTINES.users.getFollowing
      | typeof DATABASE_ROUTINES.users.getCelebrityFollowing,
    parameters: readonly unknown[],
  ): Promise<User[]> {
    const rows = await this.database.callFunction<UserRow>(routine, parameters);
    return rows.map(normalizeUser);
  }
}
