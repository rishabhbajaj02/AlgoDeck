export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
const conflicts: Record<string, string> = {
  HAS_HISTORY:
    "This collection has practice history. Archive it to preserve your records.",
  RATING_CONFLICT: "This question was already rated with different details.",
  STALE_PROGRESS: "Progress changed. Please retry.",
  CONSECUTIVE_DAY: "Questions from adjacent study days cannot be selected.",
  NOT_DUE: "A selected question is not due.",
  NEW_LIMIT: "The new-question limit was exceeded.",
  UNANSWERED_QUESTIONS:
    "Rate every selected question before completing the session.",
  ARCHIVED_COLLECTION: "Restore this collection before starting practice.",
  SESSION_COMPLETED: "This session is already complete.",
  INVALID_SELECTION: "Selection changed. Please retry.",
  INVALID_SNAPSHOT: "Scheduling changed. Please retry.",
};
export function databaseError(error: {
  code?: string;
  message?: string;
}): AppError {
  if (error.message === "NOT_FOUND")
    return new AppError(404, "NOT_FOUND", "Resource not found.");
  if (error.message === "UNAUTHORIZED")
    return new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
  if (error.message && conflicts[error.message])
    return new AppError(409, error.message, conflicts[error.message]);
  if (error.code === "23505")
    return new AppError(
      409,
      "DUPLICATE",
      "This question already exists in the collection.",
    );
  if (error.code === "42501")
    return new AppError(403, "FORBIDDEN", "Access denied.");
  return new AppError(
    503,
    "DATABASE_UNAVAILABLE",
    "The database request failed. Check your project setup and try again.",
  );
}
