import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import type {
  Gateway,
  Table,
  SelectOptions,
} from "../../src/repositories/gateway";
import { databaseError } from "../../src/utils/errors";
export async function testDatabase() {
  const db = new PGlite();
  await db.exec(
    "create role authenticated; create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  const directory = new URL("../../../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  }
  return db;
}
const identifier = (s: string) => {
  if (!/^[a-z_]+$/.test(s)) throw new Error("Invalid identifier");
  return `"${s}"`;
};
export class TestGateway implements Gateway {
  constructor(
    private db: PGlite,
    private userId: string,
  ) {}
  private async query<T>(sql: string, args: unknown[] = []): Promise<T[]> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          this.userId,
        ]);
        const rows = (await tx.query<T>(sql, args)).rows;
        return JSON.parse(
          JSON.stringify(rows, (key, value) =>
            ["session_date", "next_review_at", "study_date"].includes(key) &&
            typeof value === "string"
              ? value.slice(0, 10)
              : value,
          ),
        ) as T[];
      });
    } catch (error) {
      throw databaseError(error as { code?: string; message?: string });
    }
  }
  async select<T>(table: Table, options: SelectOptions = {}): Promise<T[]> {
    const args: unknown[] = [];
    const filters = (options.filters ?? []).map((f) => {
      const col = identifier(f.column);
      if (f.value === null) return `${col} is null`;
      args.push(f.value);
      return `${col}${f.op === "gte" ? ">=" : f.op === "lte" ? "<=" : "="}$${args.length}`;
    });
    args.push(options.limit ?? 500, options.offset ?? 0);
    return this.query<T>(
      `select * from ${identifier(table)} ${filters.length ? `where ${filters.join(" and ")}` : ""} order by ${identifier(options.order ?? "created_at")} ${options.ascending === false ? "desc" : "asc"} limit $${args.length - 1} offset $${args.length}`,
      args,
    );
  }
  async insert<T>(table: Table, data: Record<string, unknown>): Promise<T> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    const rows = await this.query<T>(
      `insert into ${identifier(table)}(${entries.map(([k]) => identifier(k)).join(",")}) values(${entries.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
      entries.map(([, v]) => v),
    );
    return rows[0];
  }
  async update<T>(
    table: Table,
    id: string,
    data: Record<string, unknown>,
  ): Promise<T | null> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    const values = entries.map(([, v]) => v);
    values.push(id);
    return (
      (
        await this.query<T>(
          `update ${identifier(table)} set ${entries.map(([k], i) => `${identifier(k)}=$${i + 1}`).join(",")} where id=$${values.length} returning *`,
          values,
        )
      )[0] ?? null
    );
  }
  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const entries = Object.entries(args);
    const expression = `${identifier(name)}(${entries.map(([k], i) => `${identifier(k)} => $${i + 1}`).join(",")})`;
    const rows = await this.query<{ result: T }>(
      `select to_jsonb(${expression}) as result`,
      entries.map(([, v]) => v),
    );
    return rows[0].result;
  }
}
