import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { env } from "./env.js";

let _client: PlaidApi | undefined;

export function plaid(): PlaidApi {
  if (_client) return _client;
  const plaidEnv = process.env.PLAID_ENV ?? "sandbox";
  const basePath = PlaidEnvironments[plaidEnv];
  if (!basePath) throw new Error(`Unknown PLAID_ENV ${plaidEnv}`);
  _client = new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: { "PLAID-CLIENT-ID": env("PLAID_CLIENT_ID"), "PLAID-SECRET": env("PLAID_SECRET") },
      },
    }),
  );
  return _client;
}
