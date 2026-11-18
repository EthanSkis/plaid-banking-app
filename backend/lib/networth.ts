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

export type AccountInfo = { id: string; type: string; current: number | null };
export type TxnLite = { accountId: string; date: string; amount: number }; // Plaid sign: + = money out
export type EstSnapshot = Snapshot & { estimated: true };

const DAY = 86_400_000;
const toDay = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / DAY);
const fromDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/**
 * Estimates daily balances before each account's first real snapshot by walking
 * backward from that anchor and undoing posted transactions.
 *   depository: balance(d-1) = balance(d) + outflows(d)    (a purchase means you had more the day before)
 *   credit:     owed(d-1)    = owed(d)    - outflows(d)    (a purchase means you owed less the day before)
 * Investment/loan values move without transactions (markets, interest), so they're carried back flat
 * instead of left out, which would fake a cliff on the day the account was linked.
 */
export function backfillSnapshots(
  accounts: AccountInfo[],
  snaps: Snapshot[],
  txns: TxnLite[],
  fromDate: string,
  today: string = new Date().toISOString().slice(0, 10),
): EstSnapshot[] {
  const from = toDay(fromDate);
  const out: EstSnapshot[] = [];

  for (const a of accounts) {
    const own = snaps.filter((s) => s.accountId === a.id && s.balance != null).sort((x, y) => x.date.localeCompare(y.date));
    const anchor = own[0] ?? (a.current != null ? { date: today, balance: a.current } : null);
    if (!anchor || anchor.balance == null) continue;

    const anchorDay = toDay(anchor.date);
    const mode = a.type === "depository" ? 1 : a.type === "credit" ? -1 : 0;

    const outflowsByDay = new Map<number, number>();
    if (mode !== 0) {
      for (const t of txns) {
        if (t.accountId !== a.id) continue;
        const d = toDay(t.date);
        if (d <= anchorDay) outflowsByDay.set(d, (outflowsByDay.get(d) ?? 0) + t.amount);
      }
    }

    let bal = anchor.balance;
    for (let d = anchorDay - 1; d >= from; d--) {
      bal += mode * (outflowsByDay.get(d + 1) ?? 0);
      out.push({ accountId: a.id, type: a.type, date: fromDay(d), balance: Math.round(bal * 100) / 100, estimated: true });
    }
  }
  return out;
}
