import { neon } from "@neondatabase/serverless";
import { env } from "./env.js";

let _sql: ReturnType<typeof neon> | undefined;

/** Lazily created so tests that never touch the DB don't need DATABASE_URL. */
export function db() {
  _sql ??= neon(env("DATABASE_URL"));
  return _sql;
}

export type Row = Record<string, any>;

export async function q<T extends Row = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  return (await db()(strings, ...values)) as T[];
}
