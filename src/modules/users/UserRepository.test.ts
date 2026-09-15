import { describe, expect, it } from "vitest";

import { DATABASE_ROUTINES } from "../../contracts/database.js";
import type { User } from "../../contracts/models.js";
import type { ApprovedRoutine, RoutineExecutor } from "../../infrastructure/database/Database.js";
import {
  FollowAlreadyExistsError,
  FollowNotFoundError,
  SelfFollowError,
  UserNotFoundError,
  UsernameAlreadyExistsError,
} from "./user.errors.js";
import { UserRepository } from "./UserRepository.js";

interface RoutineCall {
  kind: "function" | "procedure";
  routine: ApprovedRoutine;
  parameters: readonly unknown[];
}

class FakeRoutineExecutor implements RoutineExecutor {
  readonly calls: RoutineCall[] = [];
  functionRows: unknown[] = [];
  procedureError: unknown;

  async callFunction<Row>(
    routine: ApprovedRoutine,
    parameters: readonly unknown[] = [],
  ): Promise<Row[]> {
    this.calls.push({ kind: "function", routine, parameters });
    return this.functionRows as Row[];
  }

  async callProcedure(
    routine: ApprovedRoutine,
    parameters: readonly unknown[] = [],
  ): Promise<void> {
    this.calls.push({ kind: "procedure", routine, parameters });
    if (this.procedureError) throw this.procedureError;
  }
}

const userRow = {
  id: "d8f991d1-c624-4820-af0c-7be39b7d4c68",
  username: "alice",
  display_name: "Alice",
  created_at: new Date("2026-09-15T12:00:00.000Z"),
};

const normalizedUser: User = {
  id: userRow.id,
  username: "alice",
  displayName: "Alice",
  createdAt: "2026-09-15T12:00:00.000Z",
};

function postgreSqlError(code: string): Error & { code: string } {
  return Object.assign(new Error(`PostgreSQL error ${code}`), { code });
}

describe("UserRepository", () => {
  it("creates and normalizes a user through the approved database function", async () => {
    const database = new FakeRoutineExecutor();
    database.functionRows = [userRow];

    await expect(new UserRepository(database).create("alice", "Alice")).resolves.toEqual(
      normalizedUser,
    );
    expect(database.calls).toEqual([
      {
        kind: "function",
        routine: DATABASE_ROUTINES.users.createUser,
        parameters: ["alice", "Alice"],
      },
    ]);
  });

  it("returns null when pkg_users.get_user has no match", async () => {
    const database = new FakeRoutineExecutor();

    await expect(new UserRepository(database).getById(userRow.id)).resolves.toBeNull();
    expect(database.calls[0]?.routine).toBe(DATABASE_ROUTINES.users.getUser);
  });

  it("uses package routines for relationship lookups", async () => {
    const database = new FakeRoutineExecutor();
    database.functionRows = [userRow];
    const repository = new UserRepository(database);

    await expect(repository.followers(userRow.id)).resolves.toEqual([normalizedUser]);
    await repository.following(userRow.id);
    await repository.celebrityFollowing(userRow.id, 5);

    expect(database.calls.map(({ routine }) => routine)).toEqual([
      DATABASE_ROUTINES.users.getFollowers,
      DATABASE_ROUTINES.users.getFollowing,
      DATABASE_ROUTINES.users.getCelebrityFollowing,
    ]);
    expect(database.calls[2]?.parameters).toEqual([userRow.id, 5]);
  });

  it("maps PostgreSQL constraint errors to stable domain errors", async () => {
    const duplicateUserDatabase = new FakeRoutineExecutor();
    duplicateUserDatabase.callFunction = async () => {
      throw postgreSqlError("23505");
    };
    await expect(
      new UserRepository(duplicateUserDatabase).create("alice", "Alice"),
    ).rejects.toBeInstanceOf(UsernameAlreadyExistsError);

    const mappings = [
      ["23514", SelfFollowError],
      ["23505", FollowAlreadyExistsError],
      ["23503", UserNotFoundError],
    ] as const;

    for (const [code, ExpectedError] of mappings) {
      const database = new FakeRoutineExecutor();
      database.procedureError = postgreSqlError(code);
      await expect(
        new UserRepository(database).follow(userRow.id, userRow.id),
      ).rejects.toBeInstanceOf(ExpectedError);
    }
  });

  it("maps a missing unfollow relationship and preserves unknown failures", async () => {
    const missingDatabase = new FakeRoutineExecutor();
    missingDatabase.procedureError = postgreSqlError("P0002");
    await expect(
      new UserRepository(missingDatabase).unfollow(userRow.id, crypto.randomUUID()),
    ).rejects.toBeInstanceOf(FollowNotFoundError);

    const unknownDatabase = new FakeRoutineExecutor();
    const unknownError = postgreSqlError("XX000");
    unknownDatabase.procedureError = unknownError;
    await expect(
      new UserRepository(unknownDatabase).follow(userRow.id, crypto.randomUUID()),
    ).rejects.toBe(unknownError);
  });
});
