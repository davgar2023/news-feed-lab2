import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";

import type { ApiErrorBody, HealthStatus } from "./contracts/http.js";
import { createFeedRouter } from "./modules/feed/index.js";
import { createPostRouter } from "./modules/posts/index.js";
import { createUsersRouter } from "./modules/users/index.js";

export interface HealthCheck {
  healthCheck(): Promise<boolean>;
}

export interface ApplicationHealthDependencies {
  postgres: HealthCheck;
  redis: HealthCheck;
  rabbitmq: HealthCheck;
}

export interface ApplicationRouters {
  users: RequestHandler;
  posts: RequestHandler;
  feed: RequestHandler;
}

export interface CreateAppOptions {
  trustProxy?: boolean | number | string;
  health?: ApplicationHealthDependencies;
  routers?: Partial<ApplicationRouters>;
  onError?: (error: unknown) => void;
}

const unavailableHealthCheck: HealthCheck = {
  healthCheck: async () => false,
};

function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

async function check(dependency: HealthCheck): Promise<boolean> {
  try {
    return await dependency.healthCheck();
  } catch {
    return false;
  }
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const health = options.health ?? {
    postgres: unavailableHealthCheck,
    redis: unavailableHealthCheck,
    rabbitmq: unavailableHealthCheck,
  };

  app.set("trust proxy", options.trustProxy ?? false);
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/health/ready", async (_request, response) => {
    const [postgres, redis, rabbitmq] = await Promise.all([
      check(health.postgres),
      check(health.redis),
      check(health.rabbitmq),
    ]);
    const ready = postgres && redis && rabbitmq;
    const body: HealthStatus = {
      status: ready ? "ok" : "degraded",
      dependencies: { postgres, redis, rabbitmq },
    };
    response.status(ready ? 200 : 503).json(body);
  });

  app.use("/api/users", options.routers?.users ?? createUsersRouter());
  app.use(options.routers?.posts ?? createPostRouter());
  app.use(options.routers?.feed ?? createFeedRouter());

  app.use((_request, response) => {
    response.status(404).json(errorBody("NOT_FOUND", "Requested resource was not found"));
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
    options.onError?.(error);
    if (response.headersSent) {
      next(error);
      return;
    }
    response.status(500).json(errorBody("INTERNAL_ERROR", "Internal server error"));
  };
  app.use(errorHandler);

  return app;
}
