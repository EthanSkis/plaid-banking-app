import { route, json, HttpError } from "../../lib/http.js";
import { requireUser } from "../../lib/auth.js";
import { plaid } from "../../lib/plaid.js";
import { decrypt } from "../../lib/crypto.js";
import { q } from "../../lib/db.js";

// DELETE /api/items/:id -> unlink a bank (revokes the token at Plaid, deletes its data)
export const DELETE = route(async (req) => {
  const userId = await requireUser(req);
  const id = decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");
  const [item] = await q<{ access_token_enc: string }>`select access_token_enc from items where id = ${id} and user_id = ${userId}`;
  if (!item) throw new HttpError(404, "Bank not found");
  await plaid().itemRemove({ access_token: decrypt(item.access_token_enc) }).catch((e: any) =>
    console.error("itemRemove failed, deleting locally anyway", e?.response?.data?.error_code),
  );
  await q`delete from items where id = ${id} and user_id = ${userId}`;
  return json({ ok: true });
});
