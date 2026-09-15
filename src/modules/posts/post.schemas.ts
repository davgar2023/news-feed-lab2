import { z } from "zod";

const uuid = z.uuid();

export const createPostBodySchema = z
  .object({
    authorId: uuid,
    content: z.string().trim().min(1).max(280),
  })
  .strict();

export const postIdParamsSchema = z.object({ postId: uuid });

export const userPostsParamsSchema = z.object({ userId: uuid });

export const userPostsQuerySchema = z.object({
  cursor: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const deletePostBodySchema = z
  .object({
    requestingUserId: uuid,
  })
  .strict();

export type CreatePostInput = z.infer<typeof createPostBodySchema>;
export type UserPostsQuery = z.infer<typeof userPostsQuerySchema>;
export type DeletePostInput = z.infer<typeof deletePostBodySchema>;
