import { route, json } from "../../lib/http.js";
import { requireUser } from "../../lib/auth.js";
import { q } from "../../lib/db.js";

// GET ?months=12 -> monthly income vs spending, plus top spending categories for the current month.
// Transfers and credit card payments are excluded, otherwise paying your card counts as spending twice.
export const GET = route(async (req) => {
  const userId = await requireUser(req);
  const months = Math.min(Number(new URL(req.url).searchParams.get("months") ?? 12) || 12, 36);

  const monthly = await q`
    select to_char(date_trunc('month', date), 'YYYY-MM') as month,
           coalesce(sum(-amount) filter (where amount < 0), 0)::float8 as income,
           coalesce(sum(amount)  filter (where amount > 0), 0)::float8 as spending
    from transactions
    where user_id = ${userId} and not pending
      and date >= date_trunc('month', current_date) - make_interval(months => ${months - 1}::int)
      and coalesce(category_primary, '') not in ('TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS')
    group by 1 order by 1`;

  const categories = await q`
    select coalesce(category_primary, 'OTHER') as category, sum(amount)::float8 as total
    from transactions
    where user_id = ${userId} and not pending and amount > 0
      and date >= date_trunc('month', current_date)
      and coalesce(category_primary, '') not in ('TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS')
    group by 1 order by 2 desc limit 8`;

  return json({ monthly, categories });
});
