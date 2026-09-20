import { Router } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp, type ApplicationHealthDependencies } from "./app.js";

function health(result: boolean): ApplicationHealthDependencies["postgres"] {
  return { healthCheck: vi.fn(async () => result) };
}

function routers() {
  const users = Router().get("/probe", (_request, response) => response.json({ router: "users" }));
  const posts = Router().get("/api/posts-probe", (_request, response) =>
    response.json({ router: "posts" }),
  );
  const feed = Router().get("/api/feed-probe", (_request, response) =>
    response.json({ router: "feed" }),
  );
  return { users, posts, feed };
}

describe("createApp", () => {
  it("mounts every module router at its public path", async () => {
    const app = createApp({ routers: routers() });

    await request(app).get("/api/users/probe").expect(200, { router: "users" });
    await request(app).get("/api/posts-probe").expect(200, { router: "posts" });
    await request(app).get("/api/feed-probe").expect(200, { router: "feed" });
  });

  it("parses JSON and applies the configured trust proxy setting", async () => {
    const posts = Router().post("/api/echo", (req, res) =>
      res.json({ body: req.body, ip: req.ip }),
    );
    const app = createApp({ trustProxy: true, routers: { ...routers(), posts } });

    await request(app)
      .post("/api/echo")
      .set("x-forwarded-for", "203.0.113.8")
      .send({ hello: "world" })
      .expect(200, { body: { hello: "world" }, ip: "203.0.113.8" });
  });

  it("reports liveness without consulting external dependencies", async () => {
    const dependencies = {
      postgres: health(false),
      redis: health(false),
      rabbitmq: health(false),
    };

    await request(createApp({ health: dependencies, routers: routers() }))
      .get("/health")
      .expect(200, { status: "ok" });
    expect(dependencies.postgres.healthCheck).not.toHaveBeenCalled();
  });

  it("reports readiness and returns 503 when a dependency is unavailable", async () => {
    const dependencies = {
      postgres: health(true),
      redis: health(false),
      rabbitmq: { healthCheck: vi.fn(async () => Promise.reject(new Error("offline"))) },
    };

    await request(createApp({ health: dependencies, routers: routers() }))
      .get("/health/ready")
      .expect(503, {
        status: "degraded",
        dependencies: { postgres: true, redis: false, rabbitmq: false },
      });
  });

  it("returns consistent JSON for unknown routes and unexpected errors", async () => {
    const posts = Router().get("/api/fail", () => {
      throw new Error("secret failure");
    });
    const onError = vi.fn();
    const app = createApp({ routers: { ...routers(), posts }, onError });

    await request(app)
      .get("/missing")
      .expect(404, {
        error: { code: "NOT_FOUND", message: "Requested resource was not found" },
      });
    await request(app)
      .get("/api/fail")
      .expect(500, {
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    expect(onError).toHaveBeenCalledOnce();
  });
});
