import { route, json } from "../http.js";
import { requireUser } from "../auth.js";
import { q } from "../db.js";
import { netWorthSeries, backfillSnapshots, type Snapshot, type AccountInfo, type TxnLite } from "../networth.js";

// GET ?days=365 -> daily net worth. Days before real snapshots exist are estimated from transaction history.
export const GET = route(async (req) => {
  const userId = await requireUser(req);
  const days = Math.min(Number(new URL(req.url).searchParams.get("days") ?? 365) || 365, 3650);

  const [snaps, accounts, txns] = await Promise.all([
    q<Snapshot>`
      select s.account_id as "accountId", a.type, to_char(s.date, 'YYYY-MM-DD') as date, s.current_balance::float8 as balance
      from balance_snapshots s join accounts a on a.id = s.account_id
      where s.user_id = ${userId} and s.date >= current_date - ${days}::int
      order by s.date`,
    q<AccountInfo>`select id, type, current_balance::float8 as current from accounts where user_id = ${userId}`,
    q<TxnLite>`
      select account_id as "accountId", to_char(date, 'YYYY-MM-DD') as date, amount::float8 as amount
      from transactions
      where user_id = ${userId} and not pending and date >= current_date - ${days}::int`,
  ]);

  if (!accounts.length) return json({ series: [], estimatedUntil: null });

  // Estimate back to the oldest transaction we have (within the requested window).
  const oldest = txns.reduce<string | null>((m, t) => (!m || t.date < m ? t.date : m), null);
  const estimated = oldest ? backfillSnapshots(accounts, snaps, txns, oldest) : [];

  const series = netWorthSeries([...estimated, ...snaps]);
  const estimatedUntil = estimated.reduce<string | null>((m, s) => (!m || s.date > m ? s.date : m), null);
  return json({
    series: series.map((p) => ({ ...p, estimated: estimatedUntil != null && p.date <= estimatedUntil })),
    estimatedUntil,
  });
});
