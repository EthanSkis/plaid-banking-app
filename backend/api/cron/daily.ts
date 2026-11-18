import { timingSafeEqual } from "node:crypto";
import { route, json, HttpError } from "../../lib/http.js";
import { env } from "../../lib/env.js";
import { q } from "../../lib/db.js";
import { syncItem } from "../../lib/sync.js";

// Vercel Cron hits this daily with "Authorization: Bearer $CRON_SECRET". Syncs every bank and snapshots balances.
export const GET = route(async (req) => {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, "Unauthorized");

  const items = await q<{ id: string; user_id: string; access_token_enc: string; sync_cursor: string | null }>`
    select id, user_id, access_token_enc, sync_cursor from items where status <> 'login_required'`;
  let ok = 0, failed = 0;
  // Sequential in small batches to stay friendly with Plaid rate limits.
  for (let i = 0; i < items.length; i += 5) {
    const res = await Promise.allSettled(items.slice(i, i + 5).map(syncItem));
    res.forEach((r) => (r.status === "fulfilled" ? ok++ : failed++));
  }
  return json({ ok, failed });
});
