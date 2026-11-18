import { CountryCode } from "plaid";
import { route, json, body, HttpError } from "../../lib/http.js";
import { requireUser } from "../../lib/auth.js";
import { plaid } from "../../lib/plaid.js";
import { encrypt } from "../../lib/crypto.js";
import { q } from "../../lib/db.js";
import { syncItem } from "../../lib/sync.js";

// POST { publicToken } -> { itemId, institutionName }
export const POST = route(async (req) => {
  const userId = await requireUser(req);
  const { publicToken } = await body<{ publicToken?: string }>(req);
  if (!publicToken) throw new HttpError(400, "publicToken required");

  const { data: ex } = await plaid().itemPublicTokenExchange({ public_token: publicToken });
  const { data: itemData } = await plaid().itemGet({ access_token: ex.access_token });
  const instId = itemData.item.institution_id ?? null;
  let instName: string | null = null;
  if (instId) {
    const { data } = await plaid().institutionsGetById({ institution_id: instId, country_codes: [CountryCode.Us] });
    instName = data.institution.name;
  }

  const enc = encrypt(ex.access_token);
  await q`insert into items (id, user_id, access_token_enc, institution_id, institution_name)
          values (${ex.item_id}, ${userId}, ${enc}, ${instId}, ${instName})
          on conflict (id) do update set access_token_enc = excluded.access_token_enc, status = 'ok', error_code = null`;

  // First sync. Plaid may still be pulling history; the daily cron and pull-to-refresh catch the rest.
  await syncItem({ id: ex.item_id, user_id: userId, access_token_enc: enc, sync_cursor: null }).catch((e: any) =>
    console.error("initial sync failed", e?.response?.data?.error_code ?? e),
  );
  return json({ itemId: ex.item_id, institutionName: instName });
});
