import type { Post } from "../../contracts/models.js";
import type { PostRepositoryContract } from "../../contracts/repositories.js";
import { PostRepository } from "./PostRepository.js";

export interface PostPage {
  posts: Post[];
  nextCursor: string | null;
}

export class PostNotFoundError extends Error {
  constructor(postId: string) {
    super(`Post ${postId} was not found`);
    this.name = "PostNotFoundError";
  }
}

export class PostService {
  constructor(private readonly repository: PostRepositoryContract = new PostRepository()) {}

  create(authorId: string, content: string): Promise<Post> {
    return this.repository.create(authorId, content);
  }

  async getById(postId: string): Promise<Post> {
    const post = await this.repository.getById(postId);
    if (!post) throw new PostNotFoundError(postId);
    return post;
  }

  async byUser(userId: string, limit: number, cursor?: string): Promise<PostPage> {
    const posts = await this.repository.byUser(userId, limit + 1, cursor);
    const hasNextPage = posts.length > limit;
    const page = hasNextPage ? posts.slice(0, limit) : posts;

    return {
      posts: page,
      nextCursor: hasNextPage ? (page.at(-1)?.createdAt ?? null) : null,
    };
  }

  async delete(postId: string, requestingUserId: string): Promise<void> {
    const deleted = await this.repository.delete(postId, requestingUserId);
    if (!deleted) throw new PostNotFoundError(postId);
  }
}
