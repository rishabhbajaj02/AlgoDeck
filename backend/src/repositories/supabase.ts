import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Gateway, Table, SelectOptions } from "./gateway.js";
import { databaseError } from "../utils/errors.js";
import type { Logger } from "pino";
export class SupabaseGateway implements Gateway {
  private client: SupabaseClient;
  constructor(
    url: string,
    key: string,
    token: string,
    requestId: string,
    private logger: Logger,
  ) {
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-request-id": requestId,
        },
      },
    });
  }
  private fail(error: { code?: string; message?: string }): never {
    this.logger.error(
      { database_code: error.code },
      "Database operation failed",
    );
    throw databaseError(error);
  }
  async select<T>(table: Table, options: SelectOptions = {}): Promise<T[]> {
    let query = this.client.from(table).select("*");
    for (const f of options.filters ?? []) {
      if (f.value === null) query = query.is(f.column, null);
      else if (f.op === "gte") query = query.gte(f.column, f.value);
      else if (f.op === "lte") query = query.lte(f.column, f.value);
      else query = query.eq(f.column, f.value);
    }
    query = query.order(options.order ?? "created_at", {
      ascending: options.ascending ?? true,
    });
    const offset = options.offset ?? 0;
    const { data, error } = await query.range(
      offset,
      offset + (options.limit ?? 500) - 1,
    );
    if (error) this.fail(error);
    return data as T[];
  }
  async insert<T>(table: Table, data: Record<string, unknown>): Promise<T> {
    const result = await this.client.from(table).insert(data).select().single();
    if (result.error) this.fail(result.error);
    return result.data as T;
  }
  async update<T>(
    table: Table,
    id: string,
    data: Record<string, unknown>,
  ): Promise<T | null> {
    const result = await this.client
      .from(table)
      .update(data)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (result.error) this.fail(result.error);
    return result.data as T | null;
  }
  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await this.client.rpc(name, args);
    if (result.error) this.fail(result.error);
    return result.data as T;
  }
}
