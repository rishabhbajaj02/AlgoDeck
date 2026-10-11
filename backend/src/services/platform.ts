import {
  addDays,
  type Collection,
  type CollectionInput,
  type Question,
  type QuestionInput,
  type Progress,
  type PracticeSession,
  type SessionQuestion,
  type RatingInput,
  type Attempt,
  type ReviewQuestion,
  type Dashboard,
  type Analytics,
  type Breakdown,
  type ImportReport,
  type Page,
} from "@algodeck/shared";
import { allRows, type Gateway, type Filter } from "../repositories/gateway.js";
import { AppError } from "../utils/errors.js";
import { selectQuestions, updateSchedule, weight } from "./scheduler.js";
import { parseImport } from "./imports.js";
import type { Logger } from "pino";

export class Platform {
  constructor(
    private db: Gateway,
    private userId: string,
    private requestId: string,
    private logger: Logger,
  ) {}
  async collections(archived = false): Promise<Collection[]> {
    return allRows(
      this.db,
      "collections",
      archived ? [] : [{ column: "archived_at", value: null }],
    );
  }
  async collection(id: string): Promise<Collection> {
    const rows = await this.db.select<Collection>("collections", {
      filters: [{ column: "id", value: id }],
    });
    if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Collection not found.");
    return rows[0];
  }
  async createCollection(input: CollectionInput) {
    return this.db.insert<Collection>("collections", {
      ...input,
      user_id: this.userId,
    });
  }
  async editCollection(id: string, input: Partial<CollectionInput>) {
    await this.collection(id);
    const row = await this.db.update<Collection>("collections", id, input);
    if (!row) throw new AppError(404, "NOT_FOUND", "Collection not found.");
    return row;
  }
  async deleteCollection(id: string) {
    await this.collection(id);
    await this.db.rpc("delete_collection", {
      p_collection: id,
      p_request_id: this.requestId,
    });
  }
  async question(id: string): Promise<Question> {
    const rows = await this.db.select<Question>("questions", {
      filters: [{ column: "id", value: id }],
    });
    if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Question not found.");
    const progress = await this.db.select<Progress>("question_progress", {
      filters: [{ column: "question_id", value: id }],
    });
    return { ...rows[0], progress: progress[0] ?? null };
  }
  async questionPool(
    collection?: string,
    includeArchived = false,
  ): Promise<Question[]> {
    const filters: Filter[] = includeArchived
      ? []
      : [{ column: "archived_at", value: null }];
    if (collection)
      filters.push({ column: "collection_id", value: collection });
    const [questions, progress] = await Promise.all([
      allRows<Question>(this.db, "questions", filters),
      allRows<Progress>(this.db, "question_progress"),
    ]);
    const map = new Map(progress.map((p) => [p.question_id, p]));
    return questions.map((q) => ({ ...q, progress: map.get(q.id) ?? null }));
  }
  async questions(
    id: string,
    filters: {
      search?: string;
      category?: string;
      pattern?: string;
      status?: string;
      page: number;
      page_size: number;
    },
    day: string,
  ): Promise<Page<Question>> {
    await this.collection(id);
    let pool = await this.questionPool(id);
    const counts = (values: string[]) =>
      values.reduce<Record<string, number>>(
        (result, value) => ({ ...result, [value]: (result[value] ?? 0) + 1 }),
        {},
      );
    const facets = {
      categories: counts(pool.map((q) => q.category)),
      patterns: counts(pool.map((q) => q.pattern)),
      statuses: counts(pool.map((q) => reviewStatus(q, day))),
    };
    if (filters.search)
      pool = pool.filter((q) =>
        `${q.title} ${q.content}`
          .toLowerCase()
          .includes(filters.search!.toLowerCase()),
      );
    if (filters.category)
      pool = pool.filter((q) => q.category === filters.category);
    if (filters.pattern)
      pool = pool.filter((q) => q.pattern === filters.pattern);
    if (filters.status)
      pool = pool.filter((q) => reviewStatus(q, day) === filters.status);
    pool.sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
    return {
      items: pool.slice(
        (filters.page - 1) * filters.page_size,
        filters.page * filters.page_size,
      ),
      total: pool.length,
      page: filters.page,
      page_size: filters.page_size,
      facets,
    };
  }
  async addQuestion(id: string, input: QuestionInput) {
    const c = await this.collection(id);
    if (c.archived_at)
      throw new AppError(
        409,
        "ARCHIVED_COLLECTION",
        "Restore this collection before adding questions.",
      );
    return this.db.insert<Question>("questions", {
      ...input,
      collection_id: id,
      user_id: this.userId,
    });
  }
  async editQuestion(id: string, input: Partial<QuestionInput>) {
    await this.question(id);
    const row = await this.db.update<Question>("questions", id, input);
    if (!row) throw new AppError(404, "NOT_FOUND", "Question not found.");
    return row;
  }
  async deleteQuestion(id: string) {
    await this.question(id);
    await this.db.update("questions", id, {
      archived_at: new Date().toISOString(),
    });
  }
  async importQuestions(
    id: string,
    format: "csv" | "json",
    content: string,
  ): Promise<ImportReport> {
    await this.collection(id);
    const parsed = parseImport(format, content);
    if (parsed.errors.length)
      throw new AppError(
        422,
        "INVALID_IMPORT",
        "Fix the highlighted import rows. Nothing was imported.",
        parsed.errors,
      );
    return this.db.rpc<ImportReport>("import_questions", {
      p_collection: id,
      p_rows: parsed.questions,
      p_request_id: this.requestId,
    });
  }
  async exportCollection(id: string) {
    const collection = await this.collection(id);
    const questions = await this.questionPool(id);
    return {
      version: 1,
      collection: {
        name: collection.name,
        description: collection.description,
      },
      questions: questions.map((q) => ({
        title: q.title,
        content: q.content,
        category: q.category,
        pattern: q.pattern,
        source_url: q.source_url,
        metadata: q.metadata,
      })),
    };
  }
  private async yesterday(
    collection: string,
    day: string,
    includeTomorrow = false,
  ): Promise<Set<string>> {
    const sessions = await this.db.select<PracticeSession>(
      "practice_sessions",
      {
        filters: [
          { column: "collection_id", value: collection },
          { column: "session_date", op: "gte", value: addDays(day, -1) },
          {
            column: "session_date",
            op: "lte",
            value: addDays(day, includeTomorrow ? 1 : -1),
          },
        ],
      },
    );
    const rows = await Promise.all(
      sessions
        .filter((s) => s.session_date !== day)
        .map((s) =>
          allRows<{ question_id: string }>(this.db, "session_questions", [
            { column: "session_id", value: s.id },
          ]),
        ),
    );
    return new Set(rows.flat().map((q) => q.question_id));
  }
  async session(id: string): Promise<PracticeSession> {
    const rows = await this.db.select<PracticeSession>("practice_sessions", {
      filters: [{ column: "id", value: id }],
    });
    if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Session not found.");
    const [selected, pool] = await Promise.all([
      allRows<Omit<SessionQuestion, "question">>(this.db, "session_questions", [
        { column: "session_id", value: id },
      ]),
      this.questionPool(rows[0].collection_id, true),
    ]);
    const map = new Map(pool.map((q) => [q.id, q]));
    const questions = selected
      .sort((a, b) => a.position - b.position)
      .map((q) => ({ ...q, question: map.get(q.question_id)! }));
    return {
      ...rows[0],
      questions,
      available_count: questions.length,
      explanation:
        questions.length < rows[0].target_question_count
          ? `Only ${questions.length} eligible questions were available. Adjacent study days, upcoming reviews and the new-question limit are respected. Add more questions or adjust the limit for a future session.`
          : null,
    };
  }
  async createSession(id: string, day: string): Promise<PracticeSession> {
    const c = await this.collection(id);
    const existing = await this.db.select<PracticeSession>(
      "practice_sessions",
      {
        filters: [
          { column: "collection_id", value: id },
          { column: "session_date", value: day },
        ],
      },
    );
    if (existing[0]) return this.session(existing[0].id);
    for (let retry = 0; retry < 3; retry++) {
      const [pool, yesterday] = await Promise.all([
        this.questionPool(id),
        this.yesterday(id, day, true),
      ]);
      const selected = selectQuestions(
        pool,
        yesterday,
        day,
        c.daily_target,
        c.new_question_limit,
      );
      this.logger.info(
        {
          collection_id: id,
          candidates: pool.length,
          excluded: selected.excluded,
          selected: selected.ids.length,
          shortage: selected.shortage,
        },
        "Daily scheduling decision",
      );
      try {
        const session = await this.db.rpc<PracticeSession>(
          "create_practice_session",
          {
            p_collection: id,
            p_date: day,
            p_questions: selected.ids,
            p_request_id: this.requestId,
          },
        );
        return this.session(session.id);
      } catch (e) {
        if (
          e instanceof AppError &&
          ["INVALID_SELECTION", "NOT_DUE", "CONSECUTIVE_DAY"].includes(
            e.code,
          ) &&
          retry < 2
        )
          continue;
        throw e;
      }
    }
    throw new AppError(
      409,
      "SCHEDULING_CONFLICT",
      "The collection changed. Try again.",
    );
  }
  async rate(
    sessionId: string,
    questionId: string,
    input: RatingInput,
  ): Promise<Attempt> {
    const s = await this.session(sessionId);
    if (!s.questions.some((q) => q.question_id === questionId))
      throw new AppError(404, "NOT_FOUND", "Question is not in this session.");
    const c = await this.collection(s.collection_id);
    for (let retry = 0; retry < 3; retry++) {
      const question = await this.question(questionId);
      const next = updateSchedule(
        question.progress,
        input.rating,
        s.session_date,
        c.review_policy,
      );
      try {
        return await this.db.rpc<Attempt>("rate_session_question", {
          p_session: sessionId,
          p_question: questionId,
          p_rating: input.rating,
          p_seconds: input.time_spent_seconds ?? null,
          p_notes: input.notes ?? null,
          p_snapshot: {
            ...next,
            version: 1,
            policy: c.review_policy,
            prior_progress: question.progress,
          },
          p_expected: question.progress?.total_attempts ?? 0,
          p_request_id: this.requestId,
        });
      } catch (e) {
        if (e instanceof AppError && e.code === "STALE_PROGRESS" && retry < 2)
          continue;
        throw e;
      }
    }
    throw new AppError(
      409,
      "STALE_PROGRESS",
      "Progress changed. Please retry.",
    );
  }
  async complete(id: string) {
    await this.session(id);
    await this.db.rpc("complete_practice_session", {
      p_session: id,
      p_request_id: this.requestId,
    });
    return this.session(id);
  }
  async history(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<Page<Attempt>> {
    await this.question(id);
    const rows = await allRows<Attempt>(this.db, "question_attempts", [
      { column: "question_id", value: id },
    ]);
    rows.sort((a, b) => b.attempted_at.localeCompare(a.attempted_at));
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      page_size: pageSize,
    };
  }
  async revision(id: string, day: string): Promise<ReviewQuestion[]> {
    await this.collection(id);
    const [pool, yesterday] = await Promise.all([
      this.questionPool(id),
      this.yesterday(id, day),
    ]);
    return pool
      .map((q) => {
        const status = reviewStatus(q, day);
        return {
          ...q,
          weight: weight(q.progress, day),
          review_status: status,
          excluded_yesterday: yesterday.has(q.id),
          reason:
            status === "unseen"
              ? "Not practiced yet."
              : `${q.progress!.last_rating} last time; next review ${q.progress!.next_review_at}.${yesterday.has(q.id) ? " Selected yesterday; eligible from tomorrow." : ""}`,
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }
  async dashboard(day: string): Promise<Dashboard> {
    const [collections, pool, attempts, sessions] = await Promise.all([
      this.collections(),
      this.questionPool(),
      allRows<Attempt>(this.db, "question_attempts"),
      allRows<PracticeSession>(this.db, "practice_sessions", [
        { column: "session_date", value: day },
      ]),
    ]);
    const active = new Set(collections.map((c) => c.id));
    const questions = pool.filter((q) => active.has(q.collection_id));
    const byId = new Map(pool.map((q) => [q.id, q]));
    const dates = new Set(attempts.map((a) => a.study_date));
    let streak = 0;
    let cursor = dates.has(day) ? day : addDays(day, -1);
    while (dates.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return {
      collections,
      sessions: await Promise.all(sessions.map((s) => this.session(s.id))),
      completed_today: attempts.filter((a) => a.study_date === day).length,
      due: questions.filter((q) => reviewStatus(q, day) === "due").length,
      overdue: questions.filter((q) => reviewStatus(q, day) === "overdue")
        .length,
      unseen: questions.filter((q) => reviewStatus(q, day) === "unseen").length,
      streak,
      weekly: Array.from({ length: 7 }, (_, i) => ({
        date: addDays(day, i - 6),
        count: attempts.filter((a) => a.study_date === addDays(day, i - 6))
          .length,
      })),
      recent: attempts
        .sort((a, b) => b.attempted_at.localeCompare(a.attempted_at))
        .slice(0, 8)
        .map((a) => ({
          ...a,
          title: byId.get(a.question_id)?.title ?? "Archived question",
        })),
    };
  }
  async analytics(id: string, day: string): Promise<Analytics> {
    await this.collection(id);
    const pool = await this.questionPool(id, true);
    const qmap = new Map(pool.map((q) => [q.id, q]));
    const attempts = (
      await allRows<Attempt>(this.db, "question_attempts")
    ).filter((a) => qmap.has(a.question_id));
    const breakdown = (field: "category" | "pattern"): Breakdown[] => {
      const groups = new Map<string, { attempts: number; successes: number }>();
      for (const a of attempts) {
        const name = qmap.get(a.question_id)![field] || "Uncategorized";
        const entry = groups.get(name) ?? { attempts: 0, successes: 0 };
        entry.attempts++;
        if (a.rating !== "hard") entry.successes++;
        groups.set(name, entry);
      }
      return [...groups].map(([name, v]) => ({
        name,
        ...v,
        rate: Math.round((100 * v.successes) / v.attempts),
      }));
    };
    return {
      trends: Array.from({ length: 30 }, (_, i) => ({
        date: addDays(day, i - 29),
        count: attempts.filter((a) => a.study_date === addDays(day, i - 29))
          .length,
      })),
      ratings: {
        easy: attempts.filter((a) => a.rating === "easy").length,
        medium: attempts.filter((a) => a.rating === "medium").length,
        hard: attempts.filter((a) => a.rating === "hard").length,
      },
      categories: breakdown("category"),
      patterns: breakdown("pattern"),
      hard_questions: pool
        .filter(
          (q) =>
            !q.archived_at &&
            (q.progress?.consecutive_difficult_ratings ?? 0) >= 2,
        )
        .sort(
          (a, b) =>
            b.progress!.consecutive_difficult_ratings -
            a.progress!.consecutive_difficult_ratings,
        ),
      workload: Array.from({ length: 14 }, (_, i) => ({
        date: addDays(day, i),
        count: pool.filter(
          (q) =>
            !q.archived_at && q.progress?.next_review_at === addDays(day, i),
        ).length,
      })),
      attempt_count: attempts.length,
      success_rate: attempts.length
        ? Math.round(
            (100 * attempts.filter((a) => a.rating !== "hard").length) /
              attempts.length,
          )
        : 0,
    };
  }
}
export function reviewStatus(
  q: Question,
  day: string,
): ReviewQuestion["review_status"] {
  if (!q.progress?.total_attempts) return "unseen";
  const date = q.progress.next_review_at?.slice(0, 10);
  return !date || date === day ? "due" : date < day ? "overdue" : "upcoming";
}
