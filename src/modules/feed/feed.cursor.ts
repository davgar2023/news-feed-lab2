import { z } from "zod";

export const feedCursorSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    postId: z.uuid(),
  })
  .strict();

export type FeedCursor = z.infer<typeof feedCursorSchema>;

export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(feedCursorSchema.parse(cursor)), "utf8").toString("base64url");
}

export function decodeFeedCursor(value: string): FeedCursor {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return feedCursorSchema.parse(decoded);
  } catch {
    throw new Error("Invalid timeline cursor");
  }
}
