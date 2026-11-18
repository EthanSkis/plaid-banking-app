// Applies db/schema.sql (idempotent). Runs automatically on every Vercel build via "vercel-build".
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.warn("[migrate] DATABASE_URL not set, skipping. Add Neon under Vercel → Storage, then redeploy.");
  process.exit(0);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await pool.end();
console.log("[migrate] Schema applied.");
