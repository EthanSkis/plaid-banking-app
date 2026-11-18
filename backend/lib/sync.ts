import type { AccountBase, Transaction, RemovedTransaction } from "plaid";
import { db, q } from "./db.js";
import { decrypt } from "./crypto.js";
import { plaid } from "./plaid.js";

const NEEDS_RELINK = new Set(["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION", "PENDING_DISCONNECT"]);

type ItemRow = { id: string; user_id: string; access_token_enc: string; sync_cursor: string | null };

/** Pulls balances + new/changed/removed transactions for one bank login. */
export async function syncItem(item: ItemRow): Promise<{ added: number; modified: number; removed: number }> {
  const accessToken = decrypt(item.access_token_enc);
  try {
    // /accounts/get returns cached balances for free. /accounts/balance/get is real-time but billed per call.
    const { data: acc } = await plaid().accountsGet({ access_token: accessToken });
    await upsertAccounts(item, acc.accounts);

    const { added, modified, removed, cursor } = await pullTransactions(accessToken, item.sync_cursor);
    await applyTransactions(item.user_id, [...added, ...modified], removed);

    await q`update items set sync_cursor = ${cursor}, status = 'ok', error_code = null, last_synced_at = now()
            where id = ${item.id}`;
    return { added: added.length, modified: modified.length, removed: removed.length };
  } catch (e: any) {
    const code: string | undefined = e?.response?.data?.error_code;
    if (code) {
      const status = NEEDS_RELINK.has(code) ? "login_required" : "error";
      await q`update items set status = ${status}, error_code = ${code} where id = ${item.id}`;
    }
    throw e;
  }
}

async function pullTransactions(accessToken: string, startCursor: string | null) {
  // If Plaid's data changes mid-pagination we must restart from the original cursor.
  for (let attempt = 0; attempt < 3; attempt++) {
    const added: Transaction[] = [], modified: Transaction[] = [], removed: RemovedTransaction[] = [];
    let cursor = startCursor ?? undefined;
    try {
      let hasMore = true;
      while (hasMore) {
        const { data } = await plaid().transactionsSync({ access_token: accessToken, cursor, count: 500 });
        added.push(...data.added);
        modified.push(...data.modified);
        removed.push(...data.removed);
        hasMore = data.has_more;
        cursor = data.next_cursor;
      }
      return { added, modified, removed, cursor: cursor ?? null };
    } catch (e: any) {
      if (e?.response?.data?.error_code !== "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION") throw e;
    }
  }
  throw new Error("Transaction sync kept changing during pagination");
}

async function upsertAccounts(item: ItemRow, accounts: AccountBase[]) {
  const sql = db();
  const today = new Date().toISOString().slice(0, 10);
  const stmts = accounts.flatMap((a) => [
    sql`insert into accounts (id, item_id, user_id, name, official_name, mask, type, subtype,
                              current_balance, available_balance, credit_limit, iso_currency_code, updated_at)
        values (${a.account_id}, ${item.id}, ${item.user_id}, ${a.name}, ${a.official_name}, ${a.mask},
                ${a.type}, ${a.subtype}, ${a.balances.current}, ${a.balances.available}, ${a.balances.limit},
                ${a.balances.iso_currency_code}, now())
        on conflict (id) do update set name = excluded.name, official_name = excluded.official_name,
          mask = excluded.mask, type = excluded.type, subtype = excluded.subtype,
          current_balance = excluded.current_balance, available_balance = excluded.available_balance,
          credit_limit = excluded.credit_limit, iso_currency_code = excluded.iso_currency_code, updated_at = now()`,
    sql`insert into balance_snapshots (account_id, user_id, date, current_balance)
        values (${a.account_id}, ${item.user_id}, ${today}, ${a.balances.current})
        on conflict (account_id, date) do update set current_balance = excluded.current_balance`,
  ]);
  if (stmts.length) await sql.transaction(stmts);
}

async function applyTransactions(userId: string, upserts: Transaction[], removed: RemovedTransaction[]) {
  const sql = db();
  const stmts = [
    ...upserts.map(
      (t) => sql`insert into transactions (id, account_id, user_id, amount, iso_currency_code, date, name,
                   merchant_name, category_primary, category_detailed, pending, logo_url)
        values (${t.transaction_id}, ${t.account_id}, ${userId}, ${t.amount}, ${t.iso_currency_code}, ${t.date},
                ${t.name}, ${t.merchant_name ?? null}, ${t.personal_finance_category?.primary ?? null},
                ${t.personal_finance_category?.detailed ?? null}, ${t.pending}, ${t.logo_url ?? null})
        on conflict (id) do update set amount = excluded.amount, date = excluded.date, name = excluded.name,
          merchant_name = excluded.merchant_name, category_primary = excluded.category_primary,
          category_detailed = excluded.category_detailed, pending = excluded.pending, logo_url = excluded.logo_url`,
    ),
    ...removed.map((r) => sql`delete from transactions where id = ${r.transaction_id} and user_id = ${userId}`),
  ];
  // Chunk so one giant initial sync (up to 2 years of history) doesn't blow request limits.
  for (let i = 0; i < stmts.length; i += 200) await sql.transaction(stmts.slice(i, i + 200));
}

export async function syncAllForUser(userId: string) {
  const items = await q<ItemRow>`select id, user_id, access_token_enc, sync_cursor from items
                                 where user_id = ${userId} and status <> 'login_required'`;
  const results = await Promise.allSettled(items.map(syncItem));
  return results.map((r, i) => ({ itemId: items[i]!.id, ok: r.status === "fulfilled" }));
}
