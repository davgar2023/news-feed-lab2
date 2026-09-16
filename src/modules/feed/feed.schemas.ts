import { z } from "zod";

import { decodeFeedCursor } from "./feed.cursor.js";

const cursor = z
  .string()
  .min(1)
  .max(512)
  .transform((value, context) => {
    try {
      return decodeFeedCursor(value);
    } catch {
      context.addIssue({ code: "custom", message: "Invalid timeline cursor" });
      return z.NEVER;
    }
  });

export const timelineQuerySchema = z
  .object({
    userId: z.uuid(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: cursor.optional(),
  })
  .strict();

export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
