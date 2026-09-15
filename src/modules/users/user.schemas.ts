import { z } from "zod";

const userId = z.uuid("User id must be a valid UUID");

export const createUserBodySchema = z.strictObject({
  username: z
    .string()
    .trim()
    .min(3, "Username must contain at least 3 characters")
    .max(32, "Username must contain at most 32 characters")
    .regex(/^[A-Za-z0-9_]+$/, "Username may only contain letters, numbers, and underscores"),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(100, "Display name must contain at most 100 characters"),
});

export const userIdParamsSchema = z.strictObject({ id: userId });

export const followBodySchema = z.strictObject({ followedId: userId });

export const unfollowParamsSchema = z.strictObject({
  id: userId,
  followedId: userId,
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type FollowBody = z.infer<typeof followBodySchema>;
export type UnfollowParams = z.infer<typeof unfollowParamsSchema>;
