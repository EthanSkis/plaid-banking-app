import { route, json } from "../lib/http.js";
import { requireUser } from "../lib/auth.js";
import { syncAllForUser } from "../lib/sync.js";

// POST -> pull latest from every linked bank. Called on pull-to-refresh.
export const POST = route(async (req) => {
  const userId = await requireUser(req);
  return json({ results: await syncAllForUser(userId) });
});
