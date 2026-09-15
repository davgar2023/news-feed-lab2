import { describe, expect, it } from "vitest";

import type { Post } from "../../contracts/models.js";
import type { PostRepositoryContract } from "../../contracts/repositories.js";
import { PostNotFoundError, PostService } from "./PostService.js";

const authorId = "11111111-1111-4111-8111-111111111111";
const postId = "22222222-2222-4222-8222-222222222222";

function makePost(id: string, createdAt: string): Post {
  return { id, authorId, content: "hello", createdAt };
}

class FakePostRepository implements PostRepositoryContract {
  posts: Post[] = [];
  deleted = true;
  byUserArguments: unknown[] | undefined;

  async create(requestAuthorId: string, content: string): Promise<Post> {
    return { id: postId, authorId: requestAuthorId, content, createdAt: "2026-09-15T12:00:00Z" };
  }

  async getById(): Promise<Post | null> {
    return this.posts[0] ?? null;
  }

  async byUser(userId: string, limit: number, before?: string): Promise<Post[]> {
    this.byUserArguments = [userId, limit, before];
    return this.posts;
  }

  async recentByAuthors(): Promise<Post[]> {
    return [];
  }

  async delete(): Promise<boolean> {
    return this.deleted;
  }
}

describe("PostService", () => {
  it("creates a post through its repository", async () => {
    const service = new PostService(new FakePostRepository());
    await expect(service.create(authorId, "hello")).resolves.toMatchObject({
      authorId,
      content: "hello",
    });
  });

  it("throws a typed not-found error for a missing post", async () => {
    const service = new PostService(new FakePostRepository());
    await expect(service.getById(postId)).rejects.toBeInstanceOf(PostNotFoundError);
  });

  it("returns a bounded page and derives its next cursor", async () => {
    const repository = new FakePostRepository();
    repository.posts = [
      makePost("00000000-0000-4000-8000-000000000001", "2026-09-15T12:00:03Z"),
      makePost("00000000-0000-4000-8000-000000000002", "2026-09-15T12:00:02Z"),
      makePost("00000000-0000-4000-8000-000000000003", "2026-09-15T12:00:01Z"),
    ];
    const service = new PostService(repository);

    await expect(service.byUser(authorId, 2)).resolves.toEqual({
      posts: repository.posts.slice(0, 2),
      nextCursor: "2026-09-15T12:00:02Z",
    });
    expect(repository.byUserArguments).toEqual([authorId, 3, undefined]);
  });

  it("rejects deletion when the database reports no matching owned post", async () => {
    const repository = new FakePostRepository();
    repository.deleted = false;
    const service = new PostService(repository);

    await expect(service.delete(postId, authorId)).rejects.toBeInstanceOf(PostNotFoundError);
  });
});
