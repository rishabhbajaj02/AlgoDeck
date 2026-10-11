import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import type { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app";
import { AppError } from "../src/utils/errors";
import { testDatabase, TestGateway } from "./helpers/database";
import { Platform } from "../src/services/platform";
import { createLogger } from "../src/config/logger";
const u1 = "00000000-0000-4000-8000-000000000001",
  u2 = "00000000-0000-4000-8000-000000000002";
let db: PGlite;
let app: ReturnType<typeof createApp>;
let collectionId: string;
let questionId: string;
let sessionId: string;
const auth = (user = "one") => ({ Authorization: `Bearer ${user}` });
beforeAll(async () => {
  db = await testDatabase();
  await db.query("insert into auth.users values($1),($2)", [u1, u2]);
  app = createApp(
    {
      NODE_ENV: "test",
      PORT: 3001,
      FRONTEND_ORIGIN: "http://localhost:5173",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLIC_KEY: "not-a-production-key-ever",
      LOG_LEVEL: "silent",
      TRUST_PROXY: 0,
    },
    {
      verifyToken: async (token) => {
        if (token === "one") return u1;
        if (token === "two") return u2;
        throw new AppError(401, "UNAUTHORIZED", "Invalid token");
      },
      gateway: (_token, user) => new TestGateway(db, user),
      ready: async () => true,
    },
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("HTTP API against isolated migrated PostgreSQL", () => {
  it("rejects absent and invalid authentication with correlation IDs", async () => {
    const a = await request(app).get("/api/collections");
    expect(a.status).toBe(401);
    expect(a.headers["x-request-id"]).toBeTruthy();
    expect(
      (await request(app).get("/api/collections").set(auth("invalid"))).status,
    ).toBe(401);
    expect((await request(app).get("/api/health")).status).toBe(200);
  });
  it("validates ownership inputs and performs collection CRUD", async () => {
    expect(
      (
        await request(app)
          .post("/api/collections")
          .set(auth())
          .send({ name: "Forged", user_id: u2 })
      ).status,
    ).toBe(400);
    const c = await request(app).post("/api/collections").set(auth()).send({
      name: "Language practice",
      daily_target: 5,
      new_question_limit: 5,
    });
    expect(c.status).toBe(201);
    collectionId = c.body.id;
    expect(
      (
        await request(app)
          .patch(`/api/collections/${collectionId}`)
          .set(auth())
          .send({ description: "Learn anything" })
      ).body.description,
    ).toBe("Learn anything");
  });
  it("isolates all resource operations between two users", async () => {
    for (const method of ["get", "patch", "delete"] as const) {
      const r = request(app)
        [method](`/api/collections/${collectionId}`)
        .set(auth("two"));
      expect(
        (await (method === "patch" ? r.send({ name: "Stolen" }) : r)).status,
      ).toBe(404);
    }
    expect(
      (await request(app).get("/api/collections").set(auth("two"))).body,
    ).toEqual([]);
  });
  it("imports atomically, deduplicates repeats, exports and searches", async () => {
    const invalid = await request(app)
      .post(`/api/collections/${collectionId}/import`)
      .set(auth())
      .send({ format: "json", content: '[{"title":"Good"},{"title":""}]' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details[0].row).toBe(2);
    expect(
      (
        await request(app)
          .get(`/api/collections/${collectionId}/questions`)
          .set(auth())
      ).body.total,
    ).toBe(0);
    const payload = {
      format: "csv",
      content:
        "title,category\nBonjour,French\nGracias,Spanish\nDanke,German\nCiao,Italian\nHello,English\nHej,Swedish",
    };
    const imported = await request(app)
      .post(`/api/collections/${collectionId}/import`)
      .set(auth())
      .send(payload);
    expect(imported.body.inserted).toBe(6);
    expect(
      (
        await request(app)
          .post(`/api/collections/${collectionId}/import`)
          .set(auth())
          .send(payload)
      ).body.duplicates,
    ).toBe(6);
    const exported = await request(app)
      .get(`/api/collections/${collectionId}/export`)
      .set(auth());
    expect(exported.body.questions).toHaveLength(6);
    expect(
      (
        await request(app)
          .get(
            `/api/collections/${collectionId}/questions?search=Bonjour&page_size=1`,
          )
          .set(auth())
      ).body.total,
    ).toBe(1);
  });
  it("returns complete category and status counts independent of pagination", async () => {
    const emptyFilters = await request(app)
      .get(
        `/api/collections/${collectionId}/questions?search=&category=&pattern=&status=`,
      )
      .set(auth());
    expect(emptyFilters.status).toBe(200);
    expect(emptyFilters.body.total).toBe(6);
    const result = await request(app)
      .get(`/api/collections/${collectionId}/questions?page_size=1`)
      .set(auth());
    expect(result.body.items).toHaveLength(1);
    expect(result.body.facets.categories.French).toBe(1);
    expect(result.body.facets.statuses.unseen).toBe(6);
    expect(Object.keys(result.body.facets.categories)).toHaveLength(6);
  });
  it("returns the same persisted session under concurrent creation", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/collections/${collectionId}/sessions`)
          .set(auth())
          .send({ timezone: "America/Toronto" }),
      ),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const sessions = new Set(responses.map((r) => r.body.id));
    expect(sessions.size).toBe(1);
    sessionId = responses[0].body.id;
    questionId = responses[0].body.questions[0].question_id;
    expect(responses[0].body.questions).toHaveLength(5);
    expect(
      new Set(
        responses[0].body.questions.map(
          (q: { question_id: string }) => q.question_id,
        ),
      ).size,
    ).toBe(5);
    expect(
      (await db.query("select * from practice_sessions")).rows,
    ).toHaveLength(1);
  });
  it("isolates sessions, questions, attempts and analytics", async () => {
    for (const path of [
      `/sessions/${sessionId}`,
      `/questions/${questionId}`,
      `/questions/${questionId}/history`,
      `/collections/${collectionId}/analytics`,
      `/collections/${collectionId}/revision-queue`,
    ])
      expect(
        (await request(app).get(`/api${path}`).set(auth("two"))).status,
      ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/sessions/${sessionId}/questions/${questionId}/rate`)
          .set(auth("two"))
          .send({ rating: "easy" })
      ).status,
    ).toBe(404);
  });
  it("rates atomically, treats repeats idempotently, rejects contradictory retries and premature completion", async () => {
    expect(
      (
        await request(app)
          .post(`/api/sessions/${sessionId}/complete`)
          .set(auth())
          .send({})
      ).status,
    ).toBe(409);
    const rate = () =>
      request(app)
        .post(`/api/sessions/${sessionId}/questions/${questionId}/rate`)
        .set(auth())
        .send({
          rating: "hard",
          time_spent_seconds: 30,
          notes: "Practice again",
        });
    const [a, b] = await Promise.all([rate(), rate()]);
    expect(a.status).toBe(200);
    expect(a.body.id).toBe(b.body.id);
    expect(
      (
        await request(app)
          .post(`/api/sessions/${sessionId}/questions/${questionId}/rate`)
          .set(auth())
          .send({ rating: "easy" })
      ).status,
    ).toBe(409);
    const history = await request(app)
      .get(`/api/questions/${questionId}/history`)
      .set(auth());
    expect(history.body.items).toHaveLength(1);
    const q = await request(app)
      .get(`/api/questions/${questionId}`)
      .set(auth());
    expect(q.body.progress.total_attempts).toBe(1);
    expect(q.body.progress.consecutive_difficult_ratings).toBe(1);
    const queue = await request(app)
      .get(`/api/collections/${collectionId}/revision-queue`)
      .set(auth());
    expect(
      queue.body.items.find((q: { id: string }) => q.id === questionId)
        .review_status,
    ).toBe("upcoming");
  });
  it("filters the revision queue before pagination", async () => {
    const result = await request(app)
      .get(
        `/api/collections/${collectionId}/revision-queue?status=upcoming&page_size=1`,
      )
      .set(auth());
    expect(result.body.total).toBe(1);
    expect(result.body.items[0].id).toBe(questionId);
  });
  it("persists remaining ratings, completion and analytics while preserving history", async () => {
    const s = await request(app).get(`/api/sessions/${sessionId}`).set(auth());
    for (const q of s.body.questions)
      if (q.question_id !== questionId)
        expect(
          (
            await request(app)
              .post(
                `/api/sessions/${sessionId}/questions/${q.question_id}/rate`,
              )
              .set(auth())
              .send({ rating: "easy" })
          ).status,
        ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/sessions/${sessionId}/complete`)
          .set(auth())
          .send({})
      ).body.status,
    ).toBe("completed");
    const a = await request(app)
      .get(`/api/collections/${collectionId}/analytics`)
      .set(auth());
    expect(a.body.attempt_count).toBe(5);
    expect(a.body.success_rate).toBe(80);
    expect(
      (
        await request(app)
          .delete(`/api/collections/${collectionId}`)
          .set(auth())
      ).status,
    ).toBe(409);
    expect(
      (await request(app).delete(`/api/questions/${questionId}`).set(auth()))
        .status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .get(`/api/questions/${questionId}/history`)
          .set(auth())
      ).body.items,
    ).toHaveLength(1);
  });
  it("deletes an unpracticed collection and enforces CORS, invalid UUIDs and malformed JSON", async () => {
    const c = await request(app)
      .post("/api/collections")
      .set(auth())
      .send({ name: "Disposable" });
    expect(
      (await request(app).delete(`/api/collections/${c.body.id}`).set(auth()))
        .status,
    ).toBe(204);
    expect(
      (await request(app).get("/api/collections/not-a-uuid").set(auth()))
        .status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get("/api/collections")
          .set("Origin", "https://evil.example")
          .set(auth())
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/collections")
          .set(auth())
          .set("Content-Type", "application/json")
          .send("{bad")
      ).status,
    ).toBe(400);
  });
  it("excludes future neighboring selections when the timezone moves the study date backward", async () => {
    const gateway = new TestGateway(db, u1);
    const platform = new Platform(
      gateway,
      u1,
      "timezone-test",
      createLogger("silent"),
    );
    const collection = await gateway.insert<{ id: string }>("collections", {
      user_id: u1,
      name: "Date boundary",
      daily_target: 1,
      new_question_limit: 1,
    });
    for (const title of ["One", "Two"])
      await gateway.insert("questions", {
        user_id: u1,
        collection_id: collection.id,
        title,
      });
    const later = await platform.createSession(collection.id, "2026-10-12");
    const earlier = await platform.createSession(collection.id, "2026-10-11");
    expect(earlier.questions).toHaveLength(1);
    expect(earlier.questions[0].question_id).not.toBe(
      later.questions[0].question_id,
    );
    expect((await platform.createSession(collection.id, "2026-10-11")).id).toBe(
      earlier.id,
    );
  });
});
