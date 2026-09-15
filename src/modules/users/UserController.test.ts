import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { User } from "../../contracts/models.js";
import { FollowAlreadyExistsError, UserNotFoundError } from "./user.errors.js";
import { UserController } from "./UserController.js";
import type { UserServiceContract } from "./UserService.js";

const alice: User = {
  id: "d8f991d1-c624-4820-af0c-7be39b7d4c68",
  username: "alice",
  displayName: "Alice",
  createdAt: "2026-09-15T12:00:00.000Z",
};

interface ResponseDouble {
  response: Response;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

function createResponse(): ResponseDouble {
  const response = {} as Response;
  const status = vi.fn(() => response);
  const json = vi.fn(() => response);
  const end = vi.fn(() => response);
  Object.assign(response, { status, json, end });
  return { response, status, json, end };
}

function createRequest(params: Record<string, string> = {}, body: unknown = {}): Request {
  return { params, body } as Request;
}

function createService(): UserServiceContract {
  return {
    createUser: vi.fn(async () => alice),
    getUser: vi.fn(async () => alice),
    followUser: vi.fn(async () => undefined),
    unfollowUser: vi.fn(async () => undefined),
    getFollowers: vi.fn(async () => [alice]),
    getFollowing: vi.fn(async () => [alice]),
    getCelebrityFollowing: vi.fn(async () => [alice]),
  };
}

describe("UserController", () => {
  it("creates a user and trims validated input", async () => {
    const service = createService();
    const controller = new UserController(service);
    const response = createResponse();

    await controller.create(
      createRequest({}, { username: " alice ", displayName: " Alice " }),
      response.response,
      vi.fn(),
    );

    expect(service.createUser).toHaveBeenCalledWith("alice", "Alice");
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(alice);
  });

  it("returns a structured validation error for malformed input", async () => {
    const response = createResponse();

    await new UserController(createService()).create(
      createRequest({}, { username: "a!", displayName: "" }),
      response.response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "VALIDATION_ERROR" }) }),
    );
  });

  it("validates UUID route parameters", async () => {
    const response = createResponse();

    await new UserController(createService()).getById(
      createRequest({ id: "not-a-uuid" }),
      response.response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: { code: "VALIDATION_ERROR", message: "User id must be a valid UUID" },
    });
  });

  it("maps domain failures to their HTTP status", async () => {
    const missingService = createService();
    missingService.getUser = vi.fn(async () => {
      throw new UserNotFoundError(alice.id);
    });
    const missingResponse = createResponse();
    await new UserController(missingService).getById(
      createRequest({ id: alice.id }),
      missingResponse.response,
      vi.fn(),
    );
    expect(missingResponse.status).toHaveBeenCalledWith(404);

    const duplicateService = createService();
    duplicateService.followUser = vi.fn(async () => {
      throw new FollowAlreadyExistsError();
    });
    const duplicateResponse = createResponse();
    await new UserController(duplicateService).follow(
      createRequest({ id: alice.id }, { followedId: crypto.randomUUID() }),
      duplicateResponse.response,
      vi.fn(),
    );
    expect(duplicateResponse.status).toHaveBeenCalledWith(409);
    expect(duplicateResponse.json).toHaveBeenCalledWith({
      error: {
        code: "FOLLOW_ALREADY_EXISTS",
        message: "The follow relationship already exists",
      },
    });
  });

  it("handles follow, unfollow, followers and following requests", async () => {
    const service = createService();
    const controller = new UserController(service);
    const followedId = crypto.randomUUID();

    const followResponse = createResponse();
    await controller.follow(
      createRequest({ id: alice.id }, { followedId }),
      followResponse.response,
      vi.fn(),
    );
    expect(service.followUser).toHaveBeenCalledWith(alice.id, followedId);
    expect(followResponse.status).toHaveBeenCalledWith(204);
    expect(followResponse.end).toHaveBeenCalledOnce();

    const unfollowResponse = createResponse();
    await controller.unfollow(
      createRequest({ id: alice.id, followedId }),
      unfollowResponse.response,
      vi.fn(),
    );
    expect(service.unfollowUser).toHaveBeenCalledWith(alice.id, followedId);
    expect(unfollowResponse.status).toHaveBeenCalledWith(204);

    const followersResponse = createResponse();
    await controller.followers(
      createRequest({ id: alice.id }),
      followersResponse.response,
      vi.fn(),
    );
    expect(followersResponse.json).toHaveBeenCalledWith([alice]);

    const followingResponse = createResponse();
    await controller.following(
      createRequest({ id: alice.id }),
      followingResponse.response,
      vi.fn(),
    );
    expect(followingResponse.json).toHaveBeenCalledWith([alice]);
  });

  it("forwards unexpected failures to the application error middleware", async () => {
    const service = createService();
    const error = new Error("database unavailable");
    service.getUser = vi.fn(async () => {
      throw error;
    });
    const next: NextFunction = vi.fn();

    await new UserController(service).getById(
      createRequest({ id: alice.id }),
      createResponse().response,
      next,
    );

    expect(next).toHaveBeenCalledWith(error);
  });
});
