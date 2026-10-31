-- Abholung als Alternative zur Lieferung. Abholbestellungen haben keine Lieferadresse (street und
-- postal_code bleiben leer) und teilen sich die Fritteusen-Kapazität pro Zeitfenster mit der Lieferung.

alter table leans.orders
  add column fulfillment_type text not null default 'delivery'
  check (fulfillment_type in ('delivery', 'pickup'));

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
    unit_price_cents_snapshot, quantity, strips_snapshot, fries_snapshot
  )
  select v_id, i ->> 'item_id', i ->> 'kind', i ->> 'name',
         (i ->> 'unit_price_cents')::integer, (i ->> 'quantity')::integer,
         (i ->> 'strips')::integer, (i ->> 'fries')::integer
  from jsonb_array_elements(p_items) as i;

  insert into leans.order_events (order_id, type, detail)
  values (v_id, 'order_created', jsonb_build_object('source', p_order ->> 'source', 'fulfillment_type', coalesce(p_order ->> 'fulfillment_type', 'delivery')));

  return query select v_id, v_number;
end;
$$;

revoke all on function leans.create_pending_order(jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function leans.create_pending_order(jsonb, jsonb, integer) to service_role;
