import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import type { ApiErrorBody } from "../../contracts/http.js";
import { UserDomainError, type UserErrorCode } from "./user.errors.js";
import {
  createUserBodySchema,
  followBodySchema,
  unfollowParamsSchema,
  userIdParamsSchema,
} from "./user.schemas.js";
import type { UserServiceContract } from "./UserService.js";

const USER_ERROR_STATUS: Record<UserErrorCode, number> = {
  USER_NOT_FOUND: 404,
  USERNAME_ALREADY_EXISTS: 409,
  SELF_FOLLOW_FORBIDDEN: 422,
  FOLLOW_ALREADY_EXISTS: 409,
  FOLLOW_NOT_FOUND: 404,
};

export class UserController {
  constructor(private readonly users: UserServiceContract) {}

  create = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createUserBodySchema.parse(request.body);
      const user = await this.users.createUser(body.username, body.displayName);
      response.status(201).json(user);
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  getById = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = userIdParamsSchema.parse(request.params);
      response.json(await this.users.getUser(id));
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  follow = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = userIdParamsSchema.parse(request.params);
      const { followedId } = followBodySchema.parse(request.body);
      await this.users.followUser(id, followedId);
      response.status(204).end();
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  unfollow = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, followedId } = unfollowParamsSchema.parse(request.params);
      await this.users.unfollowUser(id, followedId);
      response.status(204).end();
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  followers = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = userIdParamsSchema.parse(request.params);
      response.json(await this.users.getFollowers(id));
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  following = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = userIdParamsSchema.parse(request.params);
      response.json(await this.users.getFollowing(id));
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  private handleError(error: unknown, response: Response, next: NextFunction): void {
    if (error instanceof ZodError) {
      const body: ApiErrorBody = {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Request validation failed",
        },
      };
      response.status(400).json(body);
      return;
    }

    if (error instanceof UserDomainError) {
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message },
      };
      response.status(USER_ERROR_STATUS[error.code]).json(body);
      return;
    }

    next(error);
  }
}
