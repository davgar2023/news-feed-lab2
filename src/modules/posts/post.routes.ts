import { Router } from "express";

import { PostController } from "./PostController.js";

export function createPostRouter(controller: PostController = new PostController()): Router {
  const router = Router();

  router.post("/api/posts", controller.create);
  router.get("/api/posts/:postId", controller.getById);
  router.get("/api/users/:userId/posts", controller.byUser);
  router.delete("/api/posts/:postId", controller.delete);

  return router;
}

export const postRouter = createPostRouter();
