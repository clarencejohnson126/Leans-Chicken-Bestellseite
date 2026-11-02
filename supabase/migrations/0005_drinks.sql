-- Getränke (Bad Brambacher Garten-Limonaden) als zusätzliche Produkte mit Pfand und Bestand.
-- Produktdaten und Preise stehen in src/config/menu.ts; hier liegen nur Bestand und Verfügbarkeit,
-- weil der Admin sie im Betrieb ändert.

alter table leans.order_items drop constraint if exists order_items_item_kind_check;
alter table leans.order_items
  add constraint order_items_item_kind_check check (item_kind in ('menu', 'side', 'drink'));

-- Pfand je Stück zum Bestellzeitpunkt. Nicht im Stückpreis enthalten, aber in orders.total_cents.
alter table leans.order_items
  add column deposit_cents_snapshot integer not null default 0 check (deposit_cents_snapshot >= 0);

-- stock = Flaschen, die insgesamt online verkauft werden dürfen. Frei = stock minus Flaschen in
-- bezahlten, SEPA-eingereichten oder noch reservierten Bestellungen (siehe drink_stock_status).
create table leans.drink_stock (
  item_id text primary key,
  stock integer not null default 0 check (stock >= 0),
  available boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table leans.drink_stock enable row level security;
insert into leans.drink_stock (item_id, stock) values
  ('brambacher-himbeere-zitrone', 20),
  ('brambacher-pink-grapefruit', 20)
on conflict do nothing;

create or replace function leans.drink_stock_status()
returns table (item_id text, stock integer, available boolean, committed bigint)
language sql stable
set search_path = leans, pg_catalog
as $$
  select s.item_id, s.stock, s.available, coalesce(sum(i.quantity) filter (where o.id is not null), 0)
  from leans.drink_stock s
  left join leans.order_items i on i.item_id = s.item_id
  left join leans.orders o on o.id = i.order_id
    and (o.payment_status in ('paid', 'processing')
         or (o.payment_status = 'pending' and o.expires_at > now()))
  group by s.item_id, s.stock, s.available;
$$;

-- Wie 0004, zusätzlich: Getränkebestand prüfen (Zeilen gesperrt, damit gleichzeitige Checkouts nicht
-- überverkaufen) und Pfand je Position speichern. Ausverkauft → Exception "drink_sold_out:<item_id>".
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
  v_drink record;
  v_stock integer;
  v_committed integer;
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

  for v_drink in
    select i ->> 'item_id' as item_id, sum((i ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as i
    where i ->> 'kind' = 'drink'
    group by 1
    order by 1
  loop
    select s.stock into v_stock from leans.drink_stock s
    where s.item_id = v_drink.item_id and s.available
    for update;
    if not found then
      raise exception 'drink_sold_out:%', v_drink.item_id;
    end if;
    select coalesce(sum(i.quantity), 0) into v_committed
    from leans.order_items i
    join leans.orders o on o.id = i.order_id
    where i.item_id = v_drink.item_id
      and (o.payment_status in ('paid', 'processing')
           or (o.payment_status = 'pending' and o.expires_at > now()));
    if v_committed + v_drink.quantity > v_stock then
      raise exception 'drink_sold_out:%', v_drink.item_id;
    end if;
  end loop;

  insert into leans.order_counters as c (day, last_value) values (v_date, 1)
  on conflict (day) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  v_number := 'LEAN-' || to_char(v_date, 'MMDD') || '-' || lpad(v_seq::text, 3, '0');

  insert into leans.orders (
    order_number, source, customer_name, customer_phone, company, street, postal_code,
    address_note, customer_note, slot_id, delivery_date, slot_start, slot_end,
    strips, total_cents, expires_at, fulfillment_type
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
    (p_order ->> 'expires_at')::timestamptz,
    coalesce(p_order ->> 'fulfillment_type', 'delivery')
  ) returning orders.id into v_id;

  insert into leans.order_items (
    order_id, item_id, item_kind, item_name_snapshot,
    unit_price_cents_snapshot, quantity, strips_snapshot, fries_snapshot, deposit_cents_snapshot
  )
  select v_id, i ->> 'item_id', i ->> 'kind', i ->> 'name',
         (i ->> 'unit_price_cents')::integer, (i ->> 'quantity')::integer,
         (i ->> 'strips')::integer, (i ->> 'fries')::integer,
         coalesce((i ->> 'deposit_cents')::integer, 0)
  from jsonb_array_elements(p_items) as i;

  insert into leans.order_events (order_id, type, detail)
  values (v_id, 'order_created', jsonb_build_object('source', p_order ->> 'source', 'fulfillment_type', coalesce(p_order ->> 'fulfillment_type', 'delivery')));

  return query select v_id, v_number;
end;
$$;

revoke all on function leans.create_pending_order(jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function leans.drink_stock_status() from public, anon, authenticated;
grant execute on function leans.create_pending_order(jsonb, jsonb, integer) to service_role;
grant execute on function leans.drink_stock_status() to service_role;
grant all on leans.drink_stock to service_role;
