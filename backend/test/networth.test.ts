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
