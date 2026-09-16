import { Router } from "express";

import { FeedController } from "./FeedController.js";

let defaultController: FeedController | undefined;

function getDefaultController(): FeedController {
  defaultController ??= new FeedController();
  return defaultController;
}

export function createFeedRouter(controller?: FeedController): Router {
  const router = Router();
  router.get("/api/timeline", (request, response, next) =>
    (controller ?? getDefaultController()).timeline(request, response, next),
  );
  return router;
}

// Default dependencies are resolved lazily so importing the router never opens a
// Redis connection or requires application environment variables.
export const feedRouter = createFeedRouter();
