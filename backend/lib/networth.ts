export type Snapshot = { accountId: string; type: string; date: string; balance: number | null };
export type NetWorthPoint = { date: string; assets: number; liabilities: number; netWorth: number };

const LIABILITY_TYPES = new Set(["credit", "loan"]);

/**
 * Builds a daily net-worth series. Accounts missing a snapshot on a given day
 * carry their last known balance forward (e.g. a bank was down for the cron run).
 */
export function netWorthSeries(snaps: Snapshot[]): NetWorthPoint[] {
  const byDate = new Map<string, Snapshot[]>();
  for (const s of snaps) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const dates = [...byDate.keys()].sort();

  const latest = new Map<string, { type: string; balance: number }>();
  return dates.map((date) => {
    for (const s of byDate.get(date)!) if (s.balance != null) latest.set(s.accountId, { type: s.type, balance: s.balance });
    let assets = 0, liabilities = 0;
    for (const { type, balance } of latest.values()) {
      // Plaid reports credit/loan balances as positive amounts owed.
      if (LIABILITY_TYPES.has(type)) liabilities += balance;
      else assets += balance;
    }
    return { date, assets: r(assets), liabilities: r(liabilities), netWorth: r(assets - liabilities) };
  });
}

const r = (n: number) => Math.round(n * 100) / 100;
