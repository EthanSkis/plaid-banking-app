import { timingSafeEqual, createHash } from "node:crypto";
import { route, json, body, HttpError } from "../../lib/http.js";
import { issueSession } from "../../lib/auth.js";
import { q } from "../../lib/db.js";

// Single-owner password login for the web app. Set APP_PASSWORD in Vercel to enable.
// POST { password } -> { token }
const WEB_OWNER = "web:owner"; // stored in users.apple_sub; the web owner is its own user

const digest = (s: string) => createHash("sha256").update(s).digest();

export const POST = route(async (req) => {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new HttpError(503, "Web login is disabled. Set APP_PASSWORD in Vercel and redeploy.");
  const { password } = await body<{ password?: string }>(req);

  // Hash both sides so lengths match for the constant-time compare.
  if (!password || !timingSafeEqual(digest(password), digest(expected))) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    throw new HttpError(401, "Wrong password");
  }
  const [user] = await q<{ id: string }>`
    insert into users (apple_sub) values (${WEB_OWNER})
    on conflict (apple_sub) do update set apple_sub = excluded.apple_sub
    returning id`;
  return json({ token: await issueSession(user!.id) });
});
