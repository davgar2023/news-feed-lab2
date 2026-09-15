import { Router } from "express";

import { UserController } from "./UserController.js";
import { UserRepository } from "./UserRepository.js";
import { UserService, type UserServiceContract } from "./UserService.js";

export function createUsersRouter(
  service: UserServiceContract = new UserService(new UserRepository()),
): Router {
  const controller = new UserController(service);
  const router = Router();

  router.post("/", controller.create);
  router.get("/:id", controller.getById);
  router.post("/:id/follow", controller.follow);
  router.delete("/:id/follow/:followedId", controller.unfollow);
  router.get("/:id/followers", controller.followers);
  router.get("/:id/following", controller.following);

  return router;
}

export const usersRouter = createUsersRouter();
