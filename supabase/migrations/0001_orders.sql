-- Lean's Crispy Chicken – Bestellsystem, Basisschema.
-- Eigenes Schema "leans", damit sich das Supabase-Projekt mit anderen Apps teilen lässt.
-- Supabase ist die Source of Truth. Nur der Server schreibt (Service Role); RLS sperrt anon/authenticated.

create schema if not exists leans;

-- processing = SEPA-Lastschrift eingereicht, Bestätigung steht noch aus (wird trotzdem geliefert).
create type leans.payment_status as enum ('pending', 'processing', 'paid', 'expired', 'failed', 'refunded', 'released');
create type leans.fulfillment_status as enum ('NEW', 'PREP', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
create type leans.order_source as enum ('website', 'whatsapp');

-- Laufende Nummer pro Liefertag für lesbare Bestellnummern (LEAN-MMDD-NNN).
create table leans.order_counters (
  day date primary key,
  last_value integer not null default 0
);

create table leans.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  source leans.order_source not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  company text not null default '',
  street text not null,
  postal_code text not null,
  address_note text not null default '',
  customer_note text not null default '',
  slot_id text not null,               -- "2026-10-28_11:30", aus config/schedule.ts
  delivery_date date not null,
  slot_start time not null,
  slot_end time not null,
  strips integer not null check (strips >= 0),      -- Kapazitätseinheit (Fritteuse)
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'eur',
  payment_status leans.payment_status not null default 'pending',
  fulfillment_status leans.fulfillment_status not null default 'NEW',
  expires_at timestamptz not null,     -- bis dahin hält eine offene Bestellung Kapazität
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  sheet_synced_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  delivered_at timestamptz,
  refunded_at timestamptz
);
create index orders_slot_idx on leans.orders (slot_id, payment_status);
create index orders_delivery_date_idx on leans.orders (delivery_date);

create table leans.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references leans.orders (id) on delete cascade,
  item_id text not null,                -- aus config/menu.ts, z. B. "family-pack"
  item_kind text not null check (item_kind in ('menu', 'side')),
  item_name_snapshot text not null,
  unit_price_cents_snapshot integer not null,
  quantity integer not null check (quantity > 0),
  strips_snapshot integer not null,
  fries_snapshot integer not null
);
create index order_items_order_idx on leans.order_items (order_id);

-- Audit-Log für Zahlungs- und Statuswechsel.
create table leans.order_events (
  id bigserial primary key,
  order_id uuid not null references leans.orders (id) on delete cascade,
  type text not null,
  detail jsonb not null default '{}',
  actor text not null default 'system',
  created_at timestamptz not null default now()
);
create index order_events_order_idx on leans.order_events (order_id);

-- Idempotenz für Stripe-Webhooks: jedes Event wird genau einmal verarbeitet.
create table leans.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- Betriebsschalter, z. B. Bestellungen pausieren.
create table leans.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into leans.settings (key, value) values ('orders_paused', 'false');

alter table leans.order_counters enable row level security;
alter table leans.orders enable row level security;
alter table leans.order_items enable row level security;
alter table leans.order_events enable row level security;
alter table leans.stripe_events enable row level security;
alter table leans.settings enable row level security;
-- Bewusst keine Policies: nur die Service Role (Server) hat Zugriff.

-- Belegte Strips je Slot: bezahlt, SEPA in Bearbeitung oder offen und noch nicht abgelaufen.
create or replace function leans.reserved_strips(p_slot_ids text[])
returns table (slot_id text, strips bigint)
language sql stable
set search_path = leans, pg_catalog
as $$
  select o.slot_id, sum(o.strips)
  from leans.orders o
  where o.slot_id = any (p_slot_ids)
    and (o.payment_status in ('paid', 'processing')
         or (o.payment_status = 'pending' and o.expires_at > now()))
  group by o.slot_id;
$$;

-- Prüft Kapazität und legt Bestellung + Positionen in einer Transaktion an.
-- Der Advisory-Lock pro Slot verhindert Überbuchung bei gleichzeitigen Bestellungen.
create or replace function leans.create_pending_order(p_order jsonb, p_items jsonb, p_max_strips integer)
returns table (id uuid, order_number text)
language plpgsql
set search_path = leans, pg_catalog
as $$
declare
  v_slot text := p_order ->> 'slot_id';
  v_date date := (p_order ->> 'delivery_date')::date;
  v_strips integer := (p_order ->> 'strips')::integer;
  v_reserved integer;
  v_seq integer;
  v_id uuid;
  v_number text;
begin
  perform pg_advisory_xact_lock(hashtext('leans:' || v_slot));

  select coalesce(sum(o.strips), 0) into v_reserved
  from leans.orders o
  where o.slot_id = v_slot
    and (o.payment_status in ('paid', 'processing')
         or (o.payment_status = 'pending' and o.expires_at > now()));

  if v_reserved + v_strips > p_max_strips then
    return; -- leeres Ergebnis = keine Kapazität
  end if;

  insert into leans.order_counters as c (day, last_value) values (v_date, 1)
  on conflict (day) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  v_number := 'LEAN-' || to_char(v_date, 'MMDD') || '-' || lpad(v_seq::text, 3, '0');

  insert into leans.orders (
    order_number, source, customer_name, customer_phone, company, street, postal_code,
    address_note, customer_note, slot_id, delivery_date, slot_start, slot_end,
    strips, total_cents, expires_at
  ) values (
    v_number,
    (p_order ->> 'source')::leans.order_source,
    p_order ->> 'customer_name',
    p_order ->> 'customer_phone',
    coalesce(p_order ->> 'company', ''),
    p_order ->> 'street',
    p_order ->> 'postal_code',
    coalesce(p_order ->> 'address_note', ''),
    coalesce(p_order ->> 'customer_note', ''),
    v_slot,
    v_date,
    (p_order ->> 'slot_start')::time,
    (p_order ->> 'slot_end')::time,
    v_strips,
    (p_order ->> 'total_cents')::integer,
    (p_order ->> 'expires_at')::timestamptz
  ) returning orders.id into v_id;

  insert into leans.order_items (
    order_id, item_id, item_kind, item_name_snapshot,
    unit_price_cents_snapshot, quantity, strips_snapshot, fries_snapshot
  )
  select v_id, i ->> 'item_id', i ->> 'kind', i ->> 'name',
         (i ->> 'unit_price_cents')::integer, (i ->> 'quantity')::integer,
         (i ->> 'strips')::integer, (i ->> 'fries')::integer
  from jsonb_array_elements(p_items) as i;

  insert into leans.order_events (order_id, type, detail)
  values (v_id, 'order_created', jsonb_build_object('source', p_order ->> 'source'));

  return query select v_id, v_number;
end;
$$;

revoke all on function leans.create_pending_order(jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function leans.reserved_strips(text[]) from public, anon, authenticated;

-- Zugriff ausschließlich für die Service Role (Next.js-Server).
revoke all on schema leans from public, anon, authenticated;
grant usage on schema leans to service_role;
grant all on all tables in schema leans to service_role;
grant all on all sequences in schema leans to service_role;
grant execute on all functions in schema leans to service_role;
alter default privileges in schema leans grant all on tables to service_role;
alter default privileges in schema leans grant all on sequences to service_role;
alter default privileges in schema leans revoke execute on functions from public;
alter default privileges in schema leans grant execute on functions to service_role;
