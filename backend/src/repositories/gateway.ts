export type Table =
  | "collections"
  | "questions"
  | "question_progress"
  | "practice_sessions"
  | "session_questions"
  | "question_attempts"
  | "audit_events";
export type Filter = {
  column: string;
  value: string | number | null;
  op?: "eq" | "gte" | "lte";
};
export interface SelectOptions {
  filters?: Filter[];
  order?: string;
  ascending?: boolean;
  offset?: number;
  limit?: number;
}
export interface Gateway {
  select<T>(table: Table, options?: SelectOptions): Promise<T[]>;
  insert<T>(table: Table, data: Record<string, unknown>): Promise<T>;
  update<T>(
    table: Table,
    id: string,
    data: Record<string, unknown>,
  ): Promise<T | null>;
  rpc<T>(name: string, args: Record<string, unknown>): Promise<T>;
}
export async function allRows<T>(
  db: Gateway,
  table: Table,
  filters: Filter[] = [],
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const batch = await db.select<T>(table, {
      filters,
      offset,
      limit: 500,
      order: "id",
    });
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
