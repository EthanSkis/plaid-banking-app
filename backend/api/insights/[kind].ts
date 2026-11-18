// One function serves /api/insights/{networth,cashflow,recurring} (Hobby plan allows max 12 functions).
import { GET as networth } from "../../lib/handlers/networth.js";
import { GET as cashflow } from "../../lib/handlers/cashflow.js";
import { GET as recurring } from "../../lib/handlers/recurring.js";
import { json } from "../../lib/http.js";

const handlers: Record<string, (req: Request) => Promise<Response>> = { networth, cashflow, recurring };

export async function GET(req: Request) {
  const kind = new URL(req.url).pathname.split("/").pop() ?? "";
  const h = handlers[kind];
  return h ? h(req) : json({ error: "Not found" }, 404);
}
