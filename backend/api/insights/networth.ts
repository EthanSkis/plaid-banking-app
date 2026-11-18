import { route, json } from "../../lib/http.js";
import { requireUser } from "../../lib/auth.js";
import { q } from "../../lib/db.js";
import { netWorthSeries, type Snapshot } from "../../lib/networth.js";

// GET ?days=365 -> daily net worth series (starts the day you first linked a bank)
export const GET = route(async (req) => {
  const userId = await requireUser(req);
  const days = Math.min(Number(new URL(req.url).searchParams.get("days") ?? 365) || 365, 3650);
  const snaps = await q<Snapshot>`
    select s.account_id as "accountId", a.type, to_char(s.date, 'YYYY-MM-DD') as date, s.current_balance::float8 as balance
    from balance_snapshots s join accounts a on a.id = s.account_id
    where s.user_id = ${userId} and s.date >= current_date - ${days}::int
    order by s.date`;
  return json({ series: netWorthSeries(snaps) });
});
