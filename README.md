# Ledger

Personal finance app for iPhone: balances, transactions, net worth over time, cash flow, and subscription detection, powered by Plaid.

```
ios/       SwiftUI app (iOS 17+, Swift Charts, Plaid LinkKit, Sign in with Apple)
backend/   Vercel serverless API (TypeScript) + Postgres (Neon)
```

## How it fits together

```
iPhone ──Sign in with Apple──▶ /api/auth/apple ──▶ session JWT (stored in Keychain)
iPhone ──Plaid Link──▶ public_token ──▶ /api/link/exchange ──▶ Plaid access_token
                                                              (AES-256-GCM encrypted in Postgres,
                                                               never sent to the phone)
Vercel Cron (daily) ──▶ /api/cron/daily ──▶ sync every bank + snapshot balances (net worth history)
```

The Plaid secret and access tokens only ever exist on the server. The app only holds its own session token.

## Setup

### 1. Database (Neon via Vercel)

1. Create a Vercel project from this repo with **Root Directory = `backend`**.
2. In the project: Storage → Create → **Neon** (Postgres). This sets `DATABASE_URL` for you.
3. Apply the schema once from your Mac:
   ```bash
   cd backend && npm install
   DATABASE_URL='<paste from Vercel>' npm run migrate
   ```

### 2. Backend env vars (Vercel → Settings → Environment Variables)

See `backend/.env.example`. Generate the three secrets with `openssl rand -base64 32`.

| Var | Value |
|---|---|
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid dashboard → Developers → Keys |
| `PLAID_ENV` | `sandbox` (later `production`) |
| `ENCRYPTION_KEY` | 32 random bytes, base64. **Back this up.** Lose it and every bank must be relinked. |
| `SESSION_SECRET` | random |
| `CRON_SECRET` | random (Vercel uses it to authenticate the daily cron) |
| `APPLE_BUNDLE_ID` | your iOS bundle id, e.g. `com.ethanskis.plaidbank` |

Redeploy after setting them.

### 3. iOS app

```bash
brew install xcodegen
cd ios
cp Local.xcconfig.example Local.xcconfig   # set bundle id, team id, API_HOST (host only, no https://)
xcodegen
open PlaidBank.xcodeproj
```

In Xcode, make sure your team is selected under Signing & Capabilities (Sign in with Apple is already in the entitlements), plug in your iPhone, and Run.

The bundle id in `Local.xcconfig` must exactly match `APPLE_BUNDLE_ID` on the backend, or sign-in fails with 401.

### 4. Try it in Sandbox

Connect a bank → pick any institution (e.g. "First Platypus Bank") → username `user_transactions_dynamic`, password `anything`. That test user has realistic recurring transactions so the subscriptions tab has something to find.

## Notes and known limits

- **Net worth history starts the day you link.** Plaid only gives current balances; the daily cron builds history going forward.
- **Balances are Plaid's cached values** (`/accounts/get`, free), usually refreshed by Plaid a few times a day. Real-time `/accounts/balance/get` is billed per call, so it isn't used.
- **Subscription detection is our own heuristic** (`backend/lib/recurring.ts`, tested). Plaid's `/transactions/recurring/get` is a paid add-on and could replace it.
- **No webhooks yet.** Data updates on pull-to-refresh and the daily cron. Adding `SYNC_UPDATES_AVAILABLE` webhooks (with JWT verification) is the next upgrade.
- **Plaid SDK pinned to v50.** v51 introduced a new API surface; migrating is a later chore.

## Before the App Store

- Apple guideline 5.1.1(ix): finance apps should be published by a legal entity (LLC etc.), not an individual account.
- Plaid Production for other users requires their company onboarding and security questionnaire, and you pay per linked account.
- Add rate limiting on the API, a privacy policy URL, and Plaid webhooks.
- In-app account deletion (required by Apple) is already implemented: Settings → Delete account.

## Development

```bash
cd backend
npm test          # recurring detection, net worth, encryption
npm run typecheck
```
