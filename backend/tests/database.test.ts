import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { testDatabase } from "./helpers/database";
const u1 = "00000000-0000-4000-8000-000000000001",
  u2 = "00000000-0000-4000-8000-000000000002";
let db: PGlite;
let cid: string;
let qid: string;
let sid: string;
async function asUser<T>(user: string, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    return (await tx.query<T>(sql, params)).rows;
  });
}
beforeAll(async () => {
  db = await testDatabase();
  await db.query("insert into auth.users values ($1),($2)", [u1, u2]);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("canonical migration with real PostgreSQL and RLS", () => {
  it("allows owned collection/question creation", async () => {
    const rows = await asUser<{ id: string }>(
      u1,
      "insert into collections(user_id,name) values ($1,$2) returning id",
      [u1, "Study"],
    );
    cid = rows[0].id;
    const qs = await asUser<{ id: string }>(
      u1,
      "insert into questions(user_id,collection_id,title) values($1,$2,$3) returning id",
      [u1, cid, "A"],
    );
    qid = qs[0].id;
    expect(qid).toBeTruthy();
  });
  it("blocks cross-user reads and forged ownership inserts", async () => {
    expect(
      await asUser(u2, "select * from collections where id=$1", [cid]),
    ).toEqual([]);
    await expect(
      asUser(
        u2,
        "insert into questions(user_id,collection_id,title) values($1,$2,$3)",
        [u2, cid, "Forged"],
      ),
    ).rejects.toThrow();
  });
  it("creates an idempotent session and rejects cross-user RPC calls", async () => {
    await expect(
      asUser(u2, "select create_practice_session($1,$2,$3,$4)", [
        cid,
        "2026-10-11",
        [qid],
        "test",
      ]),
    ).rejects.toThrow();
    const a = await asUser<{ id: string }>(
      u1,
      "select (create_practice_session($1,$2,$3,$4)).*",
      [cid, "2026-10-11", [qid], "test"],
    );
    sid = a[0].id;
    const b = await asUser<{ id: string }>(
      u1,
      "select (create_practice_session($1,$2,$3,$4)).*",
      [cid, "2026-10-11", [qid], "test"],
    );
    expect(b[0].id).toBe(sid);
    expect(
      await asUser(u1, "select * from session_questions where session_id=$1", [
        sid,
      ]),
    ).toHaveLength(1);
  });
  it("excludes yesterday even if unanswered and disallows direct session writes", async () => {
    await expect(
      asUser(u1, "select create_practice_session($1,$2,$3,$4)", [
        cid,
        "2026-10-12",
        [qid],
        "test",
      ]),
    ).rejects.toThrow();
    await expect(
      asUser(
        u1,
        "insert into practice_sessions(user_id,collection_id,session_date,target_question_count) values($1,$2,$3,5)",
        [u1, cid, "2026-10-13"],
      ),
    ).rejects.toThrow();
  });
  it("prevents consecutive selections when study dates are created in reverse order", async () => {
    const [collection] = await asUser<{ id: string }>(
      u1,
      "insert into collections(user_id,name) values($1,'Timezone boundary') returning id",
      [u1],
    );
    const [question] = await asUser<{ id: string }>(
      u1,
      "insert into questions(user_id,collection_id,title) values($1,$2,'Boundary') returning id",
      [u1, collection.id],
    );
    await asUser(u1, "select create_practice_session($1,$2,$3,$4)", [
      collection.id,
      "2026-10-12",
      [question.id],
      "test",
    ]);
    await expect(
      asUser(u1, "select create_practice_session($1,$2,$3,$4)", [
        collection.id,
        "2026-10-11",
        [question.id],
        "test",
      ]),
    ).rejects.toThrow("CONSECUTIVE_DAY");
  });
  it("locks progress before eligibility checks so concurrent ratings cannot invalidate selection", async () => {
    const [{ source }] = (
      await db.query<{ source: string }>(
        "select prosrc as source from pg_proc where proname='create_practice_session'",
      )
    ).rows;
    const lock = source.indexOf("perform question_id from question_progress");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(source.indexOf("raise exception 'NOT_DUE'"));
    expect(
      source.slice(lock, source.indexOf("raise exception 'NOT_DUE'")),
    ).toContain("order by question_id for update");
  });
  it("rejects incomplete scheduling snapshots before writing an attempt", async () => {
    await expect(
      asUser(u1, "select rate_session_question($1,$2,$3,$4,$5,$6,$7,$8)", [
        sid,
        qid,
        "easy",
        null,
        null,
        {},
        0,
        "test",
      ]),
    ).rejects.toThrow();
    expect(await asUser(u1, "select * from question_attempts")).toHaveLength(0);
  });
  it("rejects invalid policy configuration at the database boundary", async () => {
    await expect(
      asUser(u1, "update collections set review_policy=$1 where id=$2", [
        { hard: [], medium: [3], easy: [7] },
        cid,
      ]),
    ).rejects.toThrow();
  });
  it("persists an atomic rating exactly once and makes history immutable", async () => {
    const snapshot = {
      version: 1,
      next_review_at: "2026-10-18",
      last_rating: "easy",
      current_priority: 1,
      ease_factor: 2.6,
      consecutive_successes: 1,
      consecutive_difficult_ratings: 0,
      total_attempts: 1,
      successful_attempts: 1,
      policy: {
        easy: [7, 14, 30, 60],
        medium: [3, 5, 10, 20],
        hard: [1, 2, 4, 7],
      },
    };
    const args = [sid, qid, "easy", 60, "Note", snapshot, 0, "test"];
    const a = await asUser<{ id: string }>(
      u1,
      "select (rate_session_question($1,$2,$3,$4,$5,$6,$7,$8)).*",
      args,
    );
    const b = await asUser<{ id: string }>(
      u1,
      "select (rate_session_question($1,$2,$3,$4,$5,$6,$7,$8)).*",
      args,
    );
    expect(a[0].id).toBe(b[0].id);
    expect(await asUser(u1, "select * from question_attempts")).toHaveLength(1);
    expect(
      (
        await asUser<{ total_attempts: number }>(
          u1,
          "select total_attempts from question_progress where question_id=$1",
          [qid],
        )
      )[0].total_attempts,
    ).toBe(1);
    await expect(
      asUser(u1, "update question_attempts set rating='hard'"),
    ).rejects.toThrow();
  });
  it("prevents deleting practiced collections and completes only fully rated sessions", async () => {
    await expect(
      asUser(u1, "select delete_collection($1,$2)", [cid, "test"]),
    ).rejects.toThrow();
    await asUser(u1, "select complete_practice_session($1,$2)", [sid, "test"]);
    expect(
      (
        await asUser<{ status: string }>(
          u1,
          "select status from practice_sessions where id=$1",
          [sid],
        )
      )[0].status,
    ).toBe("completed");
  });
});
