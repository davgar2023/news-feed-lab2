import { describe, expect, it } from "vitest";

import { DATABASE_ROUTINES } from "../../contracts/database.js";
import type { ApprovedRoutine, RoutineExecutor } from "../../infrastructure/database/Database.js";
import { PostRepository } from "./PostRepository.js";

const authorId = "11111111-1111-4111-8111-111111111111";
const postId = "22222222-2222-4222-8222-222222222222";
const createdAt = "2026-09-15T12:00:00.000Z";

class FakeDatabase implements RoutineExecutor {
  readonly calls: Array<{ routine: ApprovedRoutine; parameters: readonly unknown[] }> = [];

  constructor(private readonly results: unknown[][]) {}

  async callFunction<Row>(
    routine: ApprovedRoutine,
    parameters: readonly unknown[] = [],
  ): Promise<Row[]> {
    this.calls.push({ routine, parameters });
    return (this.results.shift() ?? []) as Row[];
  }

  async callProcedure(): Promise<void> {
    throw new Error("PostRepository must not invoke procedures");
  }
}

function postRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: postId,
    author_id: authorId,
    content: "hello",
    created_at: new Date(createdAt),
    ...overrides,
  };
}

describe("PostRepository", () => {
  it("creates a post and relies on one atomic create_post call", async () => {
    const db = new FakeDatabase([[postRow()]]);
    const repository = new PostRepository(db);

    await expect(repository.create(authorId, "hello")).resolves.toEqual({
      id: postId,
      authorId,
      content: "hello",
      createdAt,
    });
    expect(db.calls).toEqual([
      {
        routine: DATABASE_ROUTINES.posts.createPost,
        parameters: [authorId, "hello"],
      },
    ]);
  });

  it("gets a post and normalizes snake_case fields", async () => {
    const db = new FakeDatabase([[postRow({ created_at: createdAt })]]);
    const repository = new PostRepository(db);

    await expect(repository.getById(postId)).resolves.toMatchObject({ authorId, createdAt });
    expect(db.calls[0]).toEqual({
      routine: DATABASE_ROUTINES.posts.getPost,
      parameters: [postId],
    });
  });

  it("returns null when get_post has no row", async () => {
    const repository = new PostRepository(new FakeDatabase([[]]));
    await expect(repository.getById(postId)).resolves.toBeNull();
  });

  it("lists user posts using the SQL timestamp cursor signature", async () => {
    const db = new FakeDatabase([
      [postRow(), postRow({ id: "33333333-3333-4333-8333-333333333333" })],
    ]);
    const repository = new PostRepository(db);

    await expect(repository.byUser(authorId, 25, createdAt)).resolves.toHaveLength(2);
    expect(db.calls[0]).toEqual({
      routine: DATABASE_ROUTINES.posts.getUserPosts,
      parameters: [authorId, 25, createdAt],
    });
  });

  it("lists recent posts by authors only through get_recent_posts", async () => {
    const db = new FakeDatabase([[postRow()]]);
    const repository = new PostRepository(db);

    await expect(repository.recentByAuthors([authorId], 10)).resolves.toHaveLength(1);
    expect(db.calls[0]).toEqual({
      routine: DATABASE_ROUTINES.posts.getRecentPosts,
      parameters: [[authorId], 10, null],
    });
  });

  it("deletes through delete_post and unwraps its scalar result", async () => {
    const db = new FakeDatabase([[{ delete_post: true }]]);
    const repository = new PostRepository(db);

    await expect(repository.delete(postId, authorId)).resolves.toBe(true);
    expect(db.calls[0]).toEqual({
      routine: DATABASE_ROUTINES.posts.deletePost,
      parameters: [postId, authorId],
    });
  });
});
