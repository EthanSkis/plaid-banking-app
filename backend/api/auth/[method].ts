// One function serves /api/auth/apple and /api/auth/password.
import { POST as apple } from "../../lib/handlers/auth-apple.js";
import { POST as password } from "../../lib/handlers/auth-password.js";
import { json } from "../../lib/http.js";

const handlers: Record<string, (req: Request) => Promise<Response>> = { apple, password };

export async function POST(req: Request) {
  const method = new URL(req.url).pathname.split("/").pop() ?? "";
  const h = handlers[method];
  return h ? h(req) : json({ error: "Not found" }, 404);
}
