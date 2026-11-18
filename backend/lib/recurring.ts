/**
 * Subscription / recurring-charge detection. Plaid sells this as a paid add-on
 * (/transactions/recurring/get); this is a free heuristic that's good enough for
 * streaming services, gym, phone bill, insurance, etc.
 */
export type Tx = { name: string; merchantName: string | null; amount: number; date: string; pending: boolean };

export type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export type Recurring = {
  name: string;
  frequency: Frequency;
  averageAmount: number;
  lastAmount: number;
  lastDate: string;
  nextExpectedDate: string;
  occurrences: number;
  monthlyCost: number;
  active: boolean;
};

const BANDS: { f: Frequency; min: number; max: number; days: number; perMonth: number }[] = [
  { f: "weekly", min: 6, max: 8, days: 7, perMonth: 52 / 12 },
  { f: "biweekly", min: 13, max: 16, days: 14, perMonth: 26 / 12 },
  { f: "monthly", min: 26, max: 35, days: 30, perMonth: 1 },
  { f: "quarterly", min: 84, max: 98, days: 91, perMonth: 1 / 3 },
  { f: "yearly", min: 350, max: 380, days: 365, perMonth: 1 / 12 },
];

const DAY = 86_400_000;
const toDays = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / DAY);
const fromDays = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function normalizeMerchant(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pos|debit|purchase|recurring|payment|ach|card|\d{4,})\b/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectRecurring(txs: Tx[], today: string = new Date().toISOString().slice(0, 10)): Recurring[] {
  const groups = new Map<string, Tx[]>();
  for (const t of txs) {
    if (t.pending || t.amount <= 0) continue; // outflows only
    const key = normalizeMerchant(t.merchantName ?? t.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const out: Recurring[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const yearlyCandidate = sorted.length === 2;
    if (sorted.length < 3 && !yearlyCandidate) continue;

    const gaps = sorted.slice(1).map((t, i) => toDays(t.date) - toDays(sorted[i]!.date));
    const med = median(gaps);
    const band = BANDS.find((b) => med >= b.min && med <= b.max);
    if (!band || (yearlyCandidate && band.f !== "yearly")) continue;

    // Most gaps must fit the cadence (one missed or doubled charge is tolerated).
    const fit = gaps.filter((g) => g >= band.min && g <= band.max).length / gaps.length;
    if (fit < 0.7) continue;

    // Amounts should be stable. Allow price hikes, reject random spending at the same store.
    const amounts = sorted.map((t) => t.amount);
    const medAmt = median(amounts);
    const stable = amounts.filter((a) => Math.abs(a - medAmt) <= Math.max(1, medAmt * 0.25)).length / amounts.length;
    if (stable < 0.7) continue;

    const last = sorted[sorted.length - 1]!;
    const next = toDays(last.date) + band.days;
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    out.push({
      name: last.merchantName ?? last.name,
      frequency: band.f,
      averageAmount: round2(avg),
      lastAmount: last.amount,
      lastDate: last.date,
      nextExpectedDate: fromDays(next),
      occurrences: sorted.length,
      monthlyCost: round2(last.amount * band.perMonth),
      active: toDays(today) <= toDays(last.date) + band.max * 1.5,
    });
  }
  return out.sort((a, b) => Number(b.active) - Number(a.active) || b.monthlyCost - a.monthlyCost);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
