export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** Wraps a handler so thrown HttpErrors become JSON responses and nothing else leaks details. */
export function route(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (e: any) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
      // Plaid SDK errors are axios errors with response.data.error_code
      const plaid = e?.response?.data;
      if (plaid?.error_code) {
        console.error("Plaid error", plaid.error_code, plaid.error_message);
        return json({ error: plaid.display_message ?? "Bank connection error", code: plaid.error_code }, 502);
      }
      console.error(e);
      return json({ error: "Internal error" }, 500);
    }
  };
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}
