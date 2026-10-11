import { z } from "zod";

export const ratingSchema = z.enum(["easy", "medium", "hard"]);
export type Rating = z.infer<typeof ratingSchema>;
export const policySchema = z
  .object({
    hard: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(12)
      .default([1, 2, 4, 7]),
    medium: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(12)
      .default([3, 5, 10, 20]),
    easy: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(12)
      .default([7, 14, 30, 60]),
  })
  .strict();
export const defaultPolicy = policySchema.parse({});
export type ReviewPolicy = z.infer<typeof policySchema>;
export const collectionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).default(""),
    daily_target: z.number().int().min(1).max(50).default(5),
    new_question_limit: z.number().int().min(0).max(50).default(3),
    review_policy: policySchema.default(defaultPolicy),
    archived_at: z.string().datetime().nullable().optional(),
  })
  .strict();
export const questionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().max(20000).default(""),
    category: z.string().trim().max(80).default(""),
    pattern: z.string().trim().max(80).default(""),
    source_url: z
      .union([
        z
          .string()
          .url()
          .max(2048)
          .refine((s) => /^https?:\/\//i.test(s), "Use an http or https URL"),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => v || null),
    metadata: z
      .record(z.unknown())
      .default({})
      .refine((v) => JSON.stringify(v).length <= 20000, "Metadata too large"),
  })
  .strict();
export type CollectionInput = z.infer<typeof collectionSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type Collection = CollectionInput & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
export interface Progress {
  question_id: string;
  last_shown_at: string | null;
  last_rated_at: string | null;
  next_review_at: string | null;
  last_rating: Rating | null;
  current_priority: number;
  ease_factor: number;
  consecutive_successes: number;
  consecutive_difficult_ratings: number;
  total_attempts: number;
  successful_attempts: number;
}
export type Question = QuestionInput & {
  id: string;
  collection_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  progress?: Progress | null;
};
export interface SessionQuestion {
  id: string;
  session_id: string;
  question_id: string;
  position: number;
  status: "pending" | "completed";
  rating: Rating | null;
  question: Question;
}
export interface PracticeSession {
  id: string;
  user_id: string;
  collection_id: string;
  session_date: string;
  status: "active" | "completed";
  target_question_count: number;
  completed_at: string | null;
  created_at: string;
  questions: SessionQuestion[];
  available_count: number;
  explanation: string | null;
}
export const ratingInputSchema = z
  .object({
    rating: ratingSchema,
    time_spent_seconds: z
      .number()
      .int()
      .min(0)
      .max(86400)
      .nullable()
      .optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .strict();
export type RatingInput = z.infer<typeof ratingInputSchema>;
export interface Attempt {
  id: string;
  question_id: string;
  session_id: string;
  user_id: string;
  rating: Rating;
  attempted_at: string;
  study_date: string;
  time_spent_seconds: number | null;
  notes: string | null;
  scheduling_snapshot: Record<string, unknown>;
}
export interface Trend {
  date: string;
  count: number;
}
export interface Breakdown {
  name: string;
  attempts: number;
  successes: number;
  rate: number;
}
export interface Analytics {
  trends: Trend[];
  ratings: Record<Rating, number>;
  categories: Breakdown[];
  patterns: Breakdown[];
  hard_questions: Question[];
  workload: Trend[];
  attempt_count: number;
  success_rate: number;
}
export interface Dashboard {
  collections: Collection[];
  sessions: PracticeSession[];
  completed_today: number;
  due: number;
  overdue: number;
  unseen: number;
  streak: number;
  weekly: Trend[];
  recent: (Attempt & { title: string })[];
}
export type ReviewQuestion = Question & {
  weight: number;
  review_status: "unseen" | "due" | "overdue" | "upcoming";
  reason: string;
  excluded_yesterday: boolean;
};
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  facets?: { categories:Record<string,number>; patterns:Record<string,number>; statuses:Record<string,number> };
}
export const importSchema = z
  .object({
    format: z.enum(["csv", "json"]),
    content: z.string().min(1).max(1_000_000),
  })
  .strict();
export interface ImportReport {
  inserted: number;
  duplicates: number;
  errors: { row: number; message: string }[];
}
export const timezoneSchema = z
  .string()
  .max(100)
  .default("UTC")
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone");
export function studyDate(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
