import { route, json, HttpError } from "../lib/http.js";
import { requireUser } from "../lib/auth.js";
import { q } from "../lib/db.js";

// GET ?limit=50&cursor=<date>|<id>&q=search&accountId=...
export const GET = route(async (req) => {
  const userId = await requireUser(req);
  const p = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(p.get("limit") ?? 50) || 50, 1), 200);
  const search = p.get("q")?.trim() ? `%${p.get("q")!.trim()}%` : null;
  const accountId = p.get("accountId") || null;

  let curDate: string | null = null, curId: string | null = null;
  const cursor = p.get("cursor");
  if (cursor) {
    [curDate, curId] = cursor.split("|") as [string, string];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(curDate ?? "") || !curId) throw new HttpError(400, "Bad cursor");
  }

  const rows = await q`
    select t.id, t.account_id as "accountId", a.name as "accountName", t.amount::float8 as amount,
           t.iso_currency_code as currency, to_char(t.date, 'YYYY-MM-DD') as date, t.name,
           t.merchant_name as "merchantName", t.category_primary as category, t.pending, t.logo_url as "logoUrl"
    from transactions t join accounts a on a.id = t.account_id
    where t.user_id = ${userId}
      and (${accountId}::text is null or t.account_id = ${accountId})
      and (${search}::text is null or t.name ilike ${search} or t.merchant_name ilike ${search})
      and (${curDate}::date is null or (t.date, t.id) < (${curDate}::date, ${curId}::text))
    order by t.date desc, t.id desc
    limit ${limit + 1}`;

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return json({ transactions: page, nextCursor: rows.length > limit && last ? `${last.date}|${last.id}` : null });
});
