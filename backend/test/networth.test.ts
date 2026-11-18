import { describe, it, expect } from "vitest";
import { netWorthSeries } from "../lib/networth.js";

describe("netWorthSeries", () => {
  it("subtracts credit balances and carries missing days forward", () => {
    const s = netWorthSeries([
      { accountId: "chk", type: "depository", date: "2026-11-01", balance: 5000 },
      { accountId: "cc", type: "credit", date: "2026-11-01", balance: 1200 },
      { accountId: "chk", type: "depository", date: "2026-11-02", balance: 4800 },
      // cc missing on 11-02 -> carry 1200
    ]);
    expect(s).toEqual([
      { date: "2026-11-01", assets: 5000, liabilities: 1200, netWorth: 3800 },
      { date: "2026-11-02", assets: 4800, liabilities: 1200, netWorth: 3600 },
    ]);
  });
});

import { backfillSnapshots } from "../lib/networth.js";

describe("backfillSnapshots", () => {
  const accounts = [
    { id: "chk", type: "depository", current: 1000 },
    { id: "cc", type: "credit", current: 300 },
    { id: "brk", type: "investment", current: 5000 },
  ];

  it("undoes transactions walking backward from the first real snapshot", () => {
    const snaps = [
      { accountId: "chk", type: "depository", date: "2026-11-10", balance: 1000 },
      { accountId: "cc", type: "credit", date: "2026-11-10", balance: 300 },
    ];
    const txns = [
      { accountId: "chk", date: "2026-11-10", amount: 50 },    // spent 50 on the 10th -> had 1050 at end of 9th
      { accountId: "chk", date: "2026-11-09", amount: -2000 }, // paycheck on the 9th -> had -950 at end of 8th
      { accountId: "cc", date: "2026-11-10", amount: 100 },    // charged 100 on the 10th -> owed 200 at end of 9th
    ];
    const est = backfillSnapshots(accounts, snaps, txns, "2026-11-08", "2026-11-18");
    const at = (id: string, d: string) => est.find((e) => e.accountId === id && e.date === d)?.balance;
    expect(at("chk", "2026-11-09")).toBe(1050);
    expect(at("chk", "2026-11-08")).toBe(-950);
    expect(at("cc", "2026-11-09")).toBe(200);
    expect(at("cc", "2026-11-08")).toBe(200);
    expect(est.filter((e) => e.accountId !== "brk").every((e) => e.date < "2026-11-10")).toBe(true); // never overwrites real data
  });

  it("anchors on today's balance when there are no snapshots, and carries investments flat", () => {
    const est = backfillSnapshots(accounts, [], [{ accountId: "chk", date: "2026-11-18", amount: 25 }], "2026-11-16", "2026-11-18");
    expect(est.find((e) => e.accountId === "chk" && e.date === "2026-11-17")?.balance).toBe(1025);
    expect(est.filter((e) => e.accountId === "brk").map((e) => e.balance)).toEqual([5000, 5000]);
  });
});
