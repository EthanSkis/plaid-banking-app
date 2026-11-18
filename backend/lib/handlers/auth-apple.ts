import { route, json, body, HttpError } from "../http.js";
import { verifyAppleToken, issueSession } from "../auth.js";
import { q } from "../db.js";

// POST { identityToken } -> { token }
export const POST = route(async (req) => {
  const { identityToken } = await body<{ identityToken?: string }>(req);
  if (!identityToken) throw new HttpError(400, "identityToken required");
  const sub = await verifyAppleToken(identityToken);
  const [user] = await q<{ id: string }>`
    insert into users (apple_sub) values (${sub})
    on conflict (apple_sub) do update set apple_sub = excluded.apple_sub
    returning id`;
  return json({ token: await issueSession(user!.id) });
});
