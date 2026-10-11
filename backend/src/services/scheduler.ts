import {
  addDays,
  defaultPolicy,
  type Progress,
  type Rating,
  type ReviewPolicy,
} from "@algodeck/shared";
const baseWeights: Record<Rating, number> = { hard: 4, medium: 2, easy: 1 };
export function weight(
  progress: Progress | null | undefined,
  day: string,
): number {
  if (!progress?.total_attempts) return 1;
  const overdue = progress.next_review_at
    ? Math.max(
        0,
        (Date.parse(day) - Date.parse(progress.next_review_at.slice(0, 10))) /
          86400000,
      )
    : 0;
  return (
    (baseWeights[progress.last_rating ?? "medium"] *
      (1 + Math.min(overdue, 30) / 4) *
      (1 + Math.min(progress.consecutive_difficult_ratings, 8) * 0.5)) /
    (1 + progress.consecutive_successes * 0.15)
  );
}
export function updateSchedule(
  previous: Progress | null | undefined,
  rating: Rating,
  day: string,
  policy: ReviewPolicy = defaultPolicy,
): Progress {
  const successes =
    rating === "hard" ? 0 : (previous?.consecutive_successes ?? 0) + 1;
  const failures =
    rating === "hard" ? (previous?.consecutive_difficult_ratings ?? 0) + 1 : 0;
  const stage = Math.min(
    (rating === "hard" ? failures : successes) - 1,
    policy[rating].length - 1,
  );
  const next: Progress = {
    question_id: previous?.question_id ?? "",
    last_shown_at: previous?.last_shown_at ?? null,
    last_rated_at: new Date().toISOString(),
    next_review_at: addDays(day, policy[rating][stage]),
    last_rating: rating,
    current_priority: 1,
    ease_factor: Math.max(
      1.3,
      Math.min(
        3.5,
        (previous?.ease_factor ?? 2.5) +
          (rating === "easy" ? 0.1 : rating === "hard" ? -0.2 : 0),
      ),
    ),
    consecutive_successes: successes,
    consecutive_difficult_ratings: failures,
    total_attempts: (previous?.total_attempts ?? 0) + 1,
    successful_attempts:
      (previous?.successful_attempts ?? 0) + (rating === "hard" ? 0 : 1),
  };
  next.current_priority = weight(next, next.next_review_at!);
  return next;
}
export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function selectQuestions(
  candidates: { id: string; progress?: Progress | null }[],
  yesterday: Set<string>,
  day: string,
  target: number,
  newLimit: number,
  random: () => number = Math.random,
) {
  const unique = [...new Map(candidates.map((q) => [q.id, q])).values()];
  const pool = unique.filter(
    (q) =>
      !yesterday.has(q.id) &&
      (!q.progress?.total_attempts ||
        !q.progress.next_review_at ||
        q.progress.next_review_at.slice(0, 10) <= day),
  );
  const ids: string[] = [];
  let newCount = 0;
  while (ids.length < target && pool.length) {
    const eligible = pool.filter(
      (q) => q.progress?.total_attempts || newCount < newLimit,
    );
    if (!eligible.length) break;
    const total = eligible.reduce((sum, q) => sum + weight(q.progress, day), 0);
    let ticket = random() * total;
    const choice =
      eligible.find((q) => (ticket -= weight(q.progress, day)) < 0) ??
      eligible[eligible.length - 1];
    ids.push(choice.id);
    if (!choice.progress?.total_attempts) newCount++;
    pool.splice(
      pool.findIndex((q) => q.id === choice.id),
      1,
    );
  }
  return {
    ids,
    excluded: unique.filter((q) => yesterday.has(q.id)).length,
    eligible_count:
      ids.length + pool.filter((q) => q.progress?.total_attempts).length,
    shortage: ids.length < target,
  };
}
