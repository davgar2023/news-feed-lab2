import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import type { Post } from "../../contracts/models.js";
import type { PostRepositoryContract } from "../../contracts/repositories.js";
import { PostController } from "./PostController.js";
import { PostService } from "./PostService.js";
import { createPostRouter } from "./post.routes.js";

const authorId = "11111111-1111-4111-8111-111111111111";
const postId = "22222222-2222-4222-8222-222222222222";
const post: Post = {
  id: postId,
  authorId,
  content: "hello",
  createdAt: "2026-09-15T12:00:00Z",
};

class FakePostRepository implements PostRepositoryContract {
  createCalls = 0;
  deleteResult = true;

  async create(requestAuthorId: string, content: string): Promise<Post> {
    this.createCalls += 1;
    return { ...post, authorId: requestAuthorId, content };
  }

  async getById(): Promise<Post | null> {
    return post;
  }

  async byUser(): Promise<Post[]> {
    return [post];
  }

  async recentByAuthors(): Promise<Post[]> {
    return [];
  }

  async delete(): Promise<boolean> {
    return this.deleteResult;
  }
}

function createApp(repository: FakePostRepository) {
  const app = express();
  app.use(express.json());
  app.use(createPostRouter(new PostController(new PostService(repository))));
  app.use((_error: unknown, _request: Request, response: Response, next: NextFunction) => {
    void next;
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  });
  return app;
}

describe("post routes", () => {
  it("creates, gets, lists and deletes posts", async () => {
    const app = createApp(new FakePostRepository());

    await request(app).post("/api/posts").send({ authorId, content: " hello " }).expect(201, {
      post,
    });
    await request(app).get(`/api/posts/${postId}`).expect(200, { post });
    await request(app)
      .get(`/api/users/${authorId}/posts?limit=10`)
      .expect(200, {
        posts: [post],
        nextCursor: null,
      });
    await request(app)
      .delete(`/api/posts/${postId}`)
      .send({ requestingUserId: authorId })
      .expect(204);
  });

  it("returns 400 before the service for invalid create input", async () => {
    const repository = new FakePostRepository();
    const response = await request(createApp(repository))
      .post("/api/posts")
      .send({ authorId: "not-a-uuid", content: " ", unexpected: true })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(repository.createCalls).toBe(0);
  });

  it("validates pagination limits and ISO cursors", async () => {
    const app = createApp(new FakePostRepository());
    await request(app).get(`/api/users/${authorId}/posts?limit=101`).expect(400);
    await request(app).get(`/api/users/${authorId}/posts?cursor=yesterday`).expect(400);
  });

  it("returns 404 when an owned post cannot be deleted", async () => {
    const repository = new FakePostRepository();
    repository.deleteResult = false;
    const response = await request(createApp(repository))
      .delete(`/api/posts/${postId}`)
      .send({ requestingUserId: authorId })
      .expect(404);

    expect(response.body.error.code).toBe("POST_NOT_FOUND");
  });
});
