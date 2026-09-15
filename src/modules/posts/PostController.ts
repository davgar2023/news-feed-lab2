import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

import { PostNotFoundError, PostService } from "./PostService.js";
import {
  createPostBodySchema,
  deletePostBodySchema,
  postIdParamsSchema,
  userPostsParamsSchema,
  userPostsQuerySchema,
} from "./post.schemas.js";

function parse<T>(schema: ZodType<T>, value: unknown, response: Response): T | undefined {
  try {
    return schema.parse(value);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues.map((issue) => issue.message).join("; "),
      },
    });
    return undefined;
  }
}

function handleError(error: unknown, response: Response, next: NextFunction): void {
  if (error instanceof PostNotFoundError) {
    response.status(404).json({
      error: { code: "POST_NOT_FOUND", message: error.message },
    });
    return;
  }
  next(error);
}

export class PostController {
  constructor(private readonly service: PostService = new PostService()) {}

  create = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const body = parse(createPostBodySchema, request.body, response);
    if (!body) return;

    try {
      const post = await this.service.create(body.authorId, body.content);
      response.status(201).json({ post });
    } catch (error) {
      handleError(error, response, next);
    }
  };

  getById = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const params = parse(postIdParamsSchema, request.params, response);
    if (!params) return;

    try {
      const post = await this.service.getById(params.postId);
      response.status(200).json({ post });
    } catch (error) {
      handleError(error, response, next);
    }
  };

  byUser = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const params = parse(userPostsParamsSchema, request.params, response);
    if (!params) return;
    const query = parse(userPostsQuerySchema, request.query, response);
    if (!query) return;

    try {
      const page = await this.service.byUser(params.userId, query.limit, query.cursor);
      response.status(200).json(page);
    } catch (error) {
      handleError(error, response, next);
    }
  };

  delete = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const params = parse(postIdParamsSchema, request.params, response);
    if (!params) return;
    const body = parse(deletePostBodySchema, request.body, response);
    if (!body) return;

    try {
      await this.service.delete(params.postId, body.requestingUserId);
      response.status(204).send();
    } catch (error) {
      handleError(error, response, next);
    }
  };
}
