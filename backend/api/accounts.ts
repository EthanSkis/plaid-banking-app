import { route, json } from "../lib/http.js";
import { requireUser } from "../lib/auth.js";
import { q } from "../lib/db.js";

// GET -> banks with their accounts
export const GET = route(async (req) => {
  const userId = await requireUser(req);
  const items = await q`select id, institution_name as "institutionName", status, error_code as "errorCode",
                          last_synced_at as "lastSyncedAt"
                        from items where user_id = ${userId} order by created_at`;
  const accounts = await q`select id, item_id as "itemId", name, official_name as "officialName", mask, type, subtype,
                             current_balance::float8 as "currentBalance", available_balance::float8 as "availableBalance",
                             credit_limit::float8 as "creditLimit", iso_currency_code as "currency"
                           from accounts where user_id = ${userId} order by type, name`;
  return json({ items: items.map((i) => ({ ...i, accounts: accounts.filter((a) => a.itemId === i.id) })) });
});
