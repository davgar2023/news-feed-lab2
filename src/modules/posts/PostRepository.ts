import { DATABASE_ROUTINES } from "../../contracts/database.js";
import type { Post } from "../../contracts/models.js";
import type { PostRepositoryContract } from "../../contracts/repositories.js";
import { database, type RoutineExecutor } from "../../infrastructure/database/Database.js";

interface PostRow {
  id: string;
  author_id: string;
  content: string;
  created_at: Date | string;
}

interface DeletePostRow {
  delete_post: boolean;
}

function normalizeTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizePost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    createdAt: normalizeTimestamp(row.created_at),
  };
}

export class PostRepository implements PostRepositoryContract {
  constructor(private readonly db: RoutineExecutor = database) {}

  async create(authorId: string, content: string): Promise<Post> {
    const [row] = await this.db.callFunction<PostRow>(DATABASE_ROUTINES.posts.createPost, [
      authorId,
      content,
    ]);

    if (!row) {
      throw new Error("pkg_posts.create_post returned no post");
    }

    return normalizePost(row);
  }

  async getById(postId: string): Promise<Post | null> {
    const [row] = await this.db.callFunction<PostRow>(DATABASE_ROUTINES.posts.getPost, [postId]);
    return row ? normalizePost(row) : null;
  }

  async byUser(userId: string, limit: number, before?: string): Promise<Post[]> {
    const rows = await this.db.callFunction<PostRow>(DATABASE_ROUTINES.posts.getUserPosts, [
      userId,
      limit,
      before ?? null,
    ]);
    return rows.map(normalizePost);
  }

  async recentByAuthors(authorIds: string[], limit: number, before?: string): Promise<Post[]> {
    const rows = await this.db.callFunction<PostRow>(DATABASE_ROUTINES.posts.getRecentPosts, [
      authorIds,
      limit,
      before ?? null,
    ]);
    return rows.map(normalizePost);
  }

  async delete(postId: string, requestingUserId: string): Promise<boolean> {
    const [row] = await this.db.callFunction<DeletePostRow>(DATABASE_ROUTINES.posts.deletePost, [
      postId,
      requestingUserId,
    ]);
    return row?.delete_post ?? false;
  }
}
