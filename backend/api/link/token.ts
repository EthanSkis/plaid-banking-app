import { Products, CountryCode, type LinkTokenCreateRequest } from "plaid";
import { route, json, body, HttpError } from "../../lib/http.js";
import { requireUser } from "../../lib/auth.js";
import { plaid } from "../../lib/plaid.js";
import { decrypt } from "../../lib/crypto.js";
import { q } from "../../lib/db.js";

// POST { itemId? } -> { linkToken }. Pass itemId to re-authenticate a broken bank login (update mode).
export const POST = route(async (req) => {
  const userId = await requireUser(req);
  const { itemId } = await body<{ itemId?: string }>(req).catch(() => ({} as { itemId?: string }));

  const request: LinkTokenCreateRequest = {
    user: { client_user_id: userId },
    client_name: "Ledger",
    country_codes: [CountryCode.Us],
    language: "en",
    ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
  };

  if (itemId) {
    const [item] = await q<{ access_token_enc: string }>`select access_token_enc from items where id = ${itemId} and user_id = ${userId}`;
    if (!item) throw new HttpError(404, "Bank not found");
    request.access_token = decrypt(item.access_token_enc);
  } else {
    request.products = [Products.Transactions];
    request.transactions = { days_requested: 730 }; // 2 years of history for trends + subscription detection
  }

  const { data } = await plaid().linkTokenCreate(request);
  return json({ linkToken: data.link_token });
});
