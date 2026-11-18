import { describe, it, expect } from "vitest";
import { detectRecurring, normalizeMerchant, type Tx } from "../lib/recurring.js";

const tx = (name: string, amount: number, date: string, merchantName: string | null = name): Tx => ({
  name, merchantName, amount, date, pending: false,
});

describe("detectRecurring", () => {
  it("finds a monthly subscription and predicts the next charge", () => {
    const r = detectRecurring(
      [tx("Netflix", 15.49, "2026-07-03"), tx("Netflix", 15.49, "2026-08-03"), tx("Netflix", 17.99, "2026-09-03"), tx("Netflix", 17.99, "2026-10-03")],
      "2026-10-20",
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: "Netflix", frequency: "monthly", lastAmount: 17.99, nextExpectedDate: "2026-11-02", active: true });
  });

  it("ignores irregular spending at the same merchant", () => {
    const r = detectRecurring([tx("Target", 42, "2026-07-01"), tx("Target", 9, "2026-07-04"), tx("Target", 120, "2026-08-19"), tx("Target", 33, "2026-08-21")]);
    expect(r).toHaveLength(0);
  });

  it("ignores income and pending", () => {
    const r = detectRecurring([
      tx("Payroll", -2000, "2026-07-01"), tx("Payroll", -2000, "2026-07-15"), tx("Payroll", -2000, "2026-07-29"),
      { ...tx("Spotify", 11.99, "2026-08-01"), pending: true },
    ]);
    expect(r).toHaveLength(0);
  });

  it("detects yearly from two charges and marks lapsed subs inactive", () => {
    const r = detectRecurring([tx("Amazon Prime", 139, "2024-03-10"), tx("Amazon Prime", 139, "2025-03-10")], "2026-11-18");
    expect(r[0]).toMatchObject({ frequency: "yearly", monthlyCost: 11.58, active: false });
  });

  it("groups merchant name variants", () => {
    expect(normalizeMerchant("SPOTIFY USA 8774")).toBe(normalizeMerchant("Spotify USA"));
  });
});
