import { route, json } from "../http.js";
import { requireUser } from "../auth.js";
import { q } from "../db.js";
import { detectRecurring, type Tx } from "../recurring.js";

// GET -> detected subscriptions / recurring charges
export const GET = route(async (req) => {
  const userId = await requireUser(req);
  const txs = await q<Tx>`
    select name, merchant_name as "merchantName", amount::float8 as amount,
           to_char(date, 'YYYY-MM-DD') as date, pending
    from transactions
    where user_id = ${userId} and date >= current_date - 400
      and coalesce(category_primary, '') not in ('TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS')`;
  const recurring = detectRecurring(txs);
  const monthlyTotal = recurring.filter((r) => r.active).reduce((s, r) => s + r.monthlyCost, 0);
  return json({ recurring, monthlyTotal: Math.round(monthlyTotal * 100) / 100 });
});
