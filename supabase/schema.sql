-- ReconIQ database schema
-- Run this once in Supabase's SQL Editor (Project -> SQL Editor -> New Query)
-- Single-tenant for now, but organization_id could be added later without
-- a full rebuild if this ever needs to scale to multiple client businesses.

-- Extends Supabase's built-in auth.users with a display name.
-- Why: avoids hardcoding "Admin" everywhere -- every UI element shows
-- the real logged-in person's actual name.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- Tracks every file imported. Why: an audit trail -- "where did this
-- data come from" is a real trust requirement in finance software,
-- not decoration.
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_type text not null, -- 'bank_statement' | 'invoices'
  row_count int not null default 0,
  status text not null default 'processing', -- 'processing' | 'completed' | 'failed'
  error_message text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- The "expected" side of reconciliation.
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  customer_name text not null,
  amount numeric(12, 2) not null,
  issue_date date not null,
  due_date date,
  status text not null default 'unpaid', -- 'unpaid' | 'paid' | 'overdue'
  upload_id uuid references uploads(id) on delete set null,
  created_at timestamptz not null default now()
);

-- The "actual" side of reconciliation. raw_data keeps the original
-- imported row as JSON so a match can always be traced back to the
-- exact source line -- important for real financial audit trails.
create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  amount numeric(12, 2) not null,
  description text not null,
  reference text,
  raw_data jsonb,
  upload_id uuid references uploads(id) on delete set null,
  created_at timestamptz not null default now()
);

-- The core value of the product: the record of what the agent
-- matched and why. confidence_score + match_type let the UI show
-- "why" a match was made, not just "it matched."
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  transaction_id uuid references bank_transactions(id) on delete cascade,
  match_type text not null, -- 'exact' | 'probable' | 'manual'
  confidence_score numeric(5, 2) not null default 0,
  matched_by text not null default 'agent', -- 'agent' | 'user'
  notes text,
  created_at timestamptz not null default now()
);

-- What the client actually acts on. A discrepancy is a categorized,
-- explained problem with a dollar figure attached -- not just "no match."
create table if not exists discrepancies (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'duplicate_payment' | 'missing_invoice' | 'amount_mismatch' | 'unmatched_transaction' | 'unmatched_invoice'
  invoice_id uuid references invoices(id) on delete set null,
  transaction_id uuid references bank_transactions(id) on delete set null,
  amount_at_risk numeric(12, 2) not null default 0,
  description text not null,
  status text not null default 'open', -- 'open' | 'resolved' | 'ignored'
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Traceability of what the AI agent actually did on each run --
-- pairs directly with the Agents SDK's own tracing, and gives a real
-- audit trail for an AI-driven financial tool (trust requirement).
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null, -- 'parsing' | 'matching'
  status text not null default 'running', -- 'running' | 'completed' | 'failed'
  summary jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes on the columns every real query filters or joins on.
create index if not exists idx_invoices_number on invoices (invoice_number);
create index if not exists idx_invoices_status on invoices (status);
create index if not exists idx_invoices_date on invoices (issue_date);
create index if not exists idx_transactions_reference on bank_transactions (reference);
create index if not exists idx_transactions_date on bank_transactions (transaction_date);
create index if not exists idx_discrepancies_status on discrepancies (status);
create index if not exists idx_matches_invoice on matches (invoice_id);
create index if not exists idx_matches_transaction on matches (transaction_id);

-- Row Level Security: real auth required everywhere, no anonymous
-- access to any financial data (unlike NexDesk's anonymous chat).
alter table profiles enable row level security;
alter table uploads enable row level security;
alter table invoices enable row level security;
alter table bank_transactions enable row level security;
alter table matches enable row level security;
alter table discrepancies enable row level security;
alter table agent_runs enable row level security;

create policy "authenticated read profiles" on profiles for select using (auth.uid() is not null);
create policy "users manage own profile" on profiles for all using (auth.uid() = id);

create policy "authenticated full access uploads" on uploads for all using (auth.uid() is not null);
create policy "authenticated full access invoices" on invoices for all using (auth.uid() is not null);
create policy "authenticated full access transactions" on bank_transactions for all using (auth.uid() is not null);
create policy "authenticated full access matches" on matches for all using (auth.uid() is not null);
create policy "authenticated full access discrepancies" on discrepancies for all using (auth.uid() is not null);
create policy "authenticated full access agent_runs" on agent_runs for all using (auth.uid() is not null);

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
