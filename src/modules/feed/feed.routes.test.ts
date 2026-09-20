import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import type { TimelinePage } from "../../contracts/models.js";
import { encodeFeedCursor, type FeedCursor } from "./feed.cursor.js";
import { FeedController, type TimelineService } from "./FeedController.js";
import { createFeedRouter } from "./feed.routes.js";

const userId = "11111111-1111-4111-8111-111111111111";
const cursor: FeedCursor = {
  createdAt: "2026-09-15T12:00:00.000Z",
  postId: "22222222-2222-4222-8222-222222222222",
};

class FakeFeedService implements TimelineService {
  calls: Array<{ userId: string; limit: number; cursor?: FeedCursor }> = [];
  result: TimelinePage = { items: [], nextCursor: null };

  async timeline(requestUserId: string, limit: number, requestCursor?: FeedCursor) {
    this.calls.push({ userId: requestUserId, limit, cursor: requestCursor });
    return this.result;
  }
}

function createApp(service: FakeFeedService) {
  const app = express();
  app.use(createFeedRouter(new FeedController(service)));
  app.use((_error: unknown, _request: Request, response: Response, next: NextFunction) => {
    void next;
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  });
  return app;
}

describe("feed routes", () => {
  it("serves GET /api/timeline with validated query values", async () => {
    const service = new FakeFeedService();
    const encoded = encodeFeedCursor(cursor);

    await request(createApp(service))
      .get(`/api/timeline?userId=${userId}&limit=12&cursor=${encoded}`)
      .expect(200, { items: [], nextCursor: null });

    expect(service.calls).toEqual([{ userId, limit: 12, cursor }]);
  });

  it("applies the default page size", async () => {
    const service = new FakeFeedService();

    await request(createApp(service)).get(`/api/timeline?userId=${userId}`).expect(200);

    expect(service.calls[0]?.limit).toBe(20);
  });

  it("rejects invalid user IDs, limits and cursors before calling the service", async () => {
    const service = new FakeFeedService();
    const app = createApp(service);

    for (const query of [
      "userId=not-a-uuid",
      `userId=${userId}&limit=51`,
      `userId=${userId}&cursor=not-a-cursor`,
      `userId=${userId}&unexpected=true`,
    ]) {
      const response = await request(app).get(`/api/timeline?${query}`).expect(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(service.calls).toEqual([]);
  });

  it("forwards unexpected failures to the application error middleware", async () => {
    const service = new FakeFeedService();
    service.timeline = async () => {
      throw new Error("database down");
    };

    await request(createApp(service))
      .get(`/api/timeline?userId=${userId}`)
      .expect(500, {
        error: { code: "INTERNAL_ERROR", message: "Internal error" },
      });
  });
});
