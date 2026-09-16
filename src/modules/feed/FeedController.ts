import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import type { ApiErrorBody } from "../../contracts/http.js";
import type { TimelinePage } from "../../contracts/models.js";
import { FeedService } from "./FeedService.js";
import { timelineQuerySchema } from "./feed.schemas.js";

export interface TimelineService {
  timeline(
    userId: string,
    limit: number,
    cursor?: { createdAt: string; postId: string },
  ): Promise<TimelinePage>;
}

export class FeedController {
  constructor(private readonly feed: TimelineService = new FeedService()) {}

  timeline = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const query = timelineQuerySchema.parse(request.query);
      response.status(200).json(await this.feed.timeline(query.userId, query.limit, query.cursor));
    } catch (error) {
      if (error instanceof ZodError) {
        const body: ApiErrorBody = {
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues.map((issue) => issue.message).join("; "),
          },
        };
        response.status(400).json(body);
        return;
      }
      next(error);
    }
  };
}
