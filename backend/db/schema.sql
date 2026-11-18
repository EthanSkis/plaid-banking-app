-- Idempotent: safe to run repeatedly.
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  apple_sub   text unique not null,
  created_at  timestamptz not null default now()
);

-- One row per bank login (Plaid "Item").
create table if not exists items (
  id                text primary key,              -- Plaid item_id
  user_id           uuid not null references users(id) on delete cascade,
  access_token_enc  text not null,                 -- AES-256-GCM, see lib/crypto.ts
  institution_id    text,
  institution_name  text,
  sync_cursor       text,
  status            text not null default 'ok',    -- ok | login_required | error
  error_code        text,
  last_synced_at    timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists items_user on items(user_id);

create table if not exists accounts (
  id                 text primary key,             -- Plaid account_id
  item_id            text not null references items(id) on delete cascade,
  user_id            uuid not null references users(id) on delete cascade,
  name               text not null,
  official_name      text,
  mask               text,
  type               text not null,                -- depository | credit | loan | investment | other
  subtype            text,
  current_balance    numeric,
  available_balance  numeric,
  credit_limit       numeric,
  iso_currency_code  text,
  updated_at         timestamptz not null default now()
);
create index if not exists accounts_user on accounts(user_id);

-- Plaid convention: positive amount = money leaving the account.
create table if not exists transactions (
  id                 text primary key,             -- Plaid transaction_id
  account_id         text not null references accounts(id) on delete cascade,
  user_id            uuid not null references users(id) on delete cascade,
  amount             numeric not null,
  iso_currency_code  text,
  date               date not null,
  name               text not null,
  merchant_name      text,
  category_primary   text,
  category_detailed  text,
  pending            boolean not null default false,
  logo_url           text
);
create index if not exists tx_user_date on transactions(user_id, date desc, id desc);

-- Plaid only gives current balances, so we snapshot daily to build net-worth history.
create table if not exists balance_snapshots (
  account_id       text not null references accounts(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  date             date not null,
  current_balance  numeric,
  primary key (account_id, date)
);
create index if not exists snap_user_date on balance_snapshots(user_id, date);
