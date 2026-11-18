import { route, json } from "../lib/http.js";
import { requireUser } from "../lib/auth.js";
import { plaid } from "../lib/plaid.js";
import { decrypt } from "../lib/crypto.js";
import { q } from "../lib/db.js";

// DELETE /api/me -> delete account and all data. Apple requires in-app account deletion (guideline 5.1.1(v)).
export const DELETE = route(async (req) => {
  const userId = await requireUser(req);
  const items = await q<{ access_token_enc: string }>`select access_token_enc from items where user_id = ${userId}`;
  await Promise.allSettled(items.map((i) => plaid().itemRemove({ access_token: decrypt(i.access_token_enc) })));
  await q`delete from users where id = ${userId}`; // cascades to everything
  return json({ ok: true });
});
