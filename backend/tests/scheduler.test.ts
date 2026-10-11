import { describe, it, expect } from "vitest";
import { defaultPolicy, studyDate, type Progress } from "@algodeck/shared";
import {
  weight,
  updateSchedule,
  selectQuestions,
  seededRandom,
} from "../src/services/scheduler";
const progress = (overrides: Partial<Progress> = {}): Progress => ({
  question_id: "q",
  last_shown_at: null,
  last_rated_at: null,
  next_review_at: "2026-10-11",
  last_rating: "medium",
  current_priority: 2,
  ease_factor: 2.5,
  consecutive_successes: 0,
  consecutive_difficult_ratings: 0,
  total_attempts: 1,
  successful_attempts: 0,
  ...overrides,
});
describe("adaptive scheduling", () => {
  it("separates base difficulty and overdue priority", () => {
    expect(weight(progress({ last_rating: "hard" }), "2026-10-11")).toBe(4);
    expect(weight(progress({ last_rating: "easy" }), "2026-10-11")).toBe(1);
    expect(
      weight(progress({ next_review_at: "2026-10-07" }), "2026-10-11"),
    ).toBe(4);
  });
  it("increases the review interval with successful reviews and resets after hard", () => {
    expect(
      updateSchedule(null, "easy", "2026-10-11", defaultPolicy).next_review_at,
    ).toBe("2026-10-18");
    expect(
      updateSchedule(
        progress({ consecutive_successes: 2 }),
        "easy",
        "2026-10-11",
        defaultPolicy,
      ).next_review_at,
    ).toBe("2026-11-10");
    const hard = updateSchedule(
      progress({ consecutive_successes: 3 }),
      "hard",
      "2026-10-11",
      defaultPolicy,
    );
    expect(hard.next_review_at).toBe("2026-10-12");
    expect(hard.consecutive_successes).toBe(0);
    expect(hard.consecutive_difficult_ratings).toBe(1);
  });
  it("caps difficult intervals and increases repeated failure weight", () => {
    const hard = progress({
      last_rating: "hard",
      consecutive_difficult_ratings: 10,
    });
    expect(
      updateSchedule(hard, "hard", "2026-10-11", defaultPolicy).next_review_at,
    ).toBe("2026-10-18");
    expect(weight(hard, "2026-10-11")).toBeGreaterThan(4);
  });
  it("does not choose yesterday, upcoming reviews or duplicate questions, and respects the new limit", () => {
    const input = [
      { id: "yesterday", progress: null },
      { id: "new1", progress: null },
      { id: "new2", progress: null },
      { id: "due", progress: progress() },
      { id: "later", progress: progress({ next_review_at: "2026-10-12" }) },
    ];
    const result = selectQuestions(
      input,
      new Set(["yesterday"]),
      "2026-10-11",
      5,
      1,
      seededRandom(4),
    );
    expect(result.ids.sort()).toEqual(["due", "new1"].sort());
    expect(result.shortage).toBe(true);
    expect(result.excluded).toBe(1);
    expect(new Set(result.ids).size).toBe(result.ids.length);
  });
  it("returns a deterministic weighted sample and handles empty input", () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      progress: progress({ last_rating: i % 2 ? "hard" : "easy" }),
    }));
    const a = selectQuestions(
      pool,
      new Set(),
      "2026-10-11",
      5,
      0,
      seededRandom(42),
    );
    expect(a.ids).toEqual(
      selectQuestions(pool, new Set(), "2026-10-11", 5, 0, seededRandom(42))
        .ids,
    );
    expect(a.ids.length).toBe(5);
    expect(selectQuestions([], new Set(), "2026-10-11", 5, 3).ids).toEqual([]);
  });
  it("keeps unanswered questions unseen and does not modify skipped progress", () => {
    const old = progress({ next_review_at: "2026-10-01" });
    const before = structuredClone(old);
    selectQuestions(
      [{ id: "q", progress: old }],
      new Set(["q"]),
      "2026-10-11",
      5,
      3,
    );
    expect(old).toEqual(before);
    expect(
      updateSchedule(null, "hard", "2026-10-11", defaultPolicy)
        .successful_attempts,
    ).toBe(0);
  });
  it("uses the study timezone at midnight and DST boundaries", () => {
    expect(studyDate("America/Toronto", new Date("2026-10-11T01:00:00Z"))).toBe(
      "2026-10-10",
    );
    expect(studyDate("America/Toronto", new Date("2026-11-01T06:30:00Z"))).toBe(
      "2026-11-01",
    );
  });
});
