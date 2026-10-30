-- Bestellverfolgung, Zahlungslinks für WhatsApp-Bestellungen, Erstattungen und Kundenmails.

alter table leans.orders
  -- Geheimer Link-Schlüssel für /bestellung/verfolgen/<token> (122 Bit Zufall, nicht erratbar).
  add column tracking_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- Stripe-Checkout-URL, damit Lean den Zahlungslink einer WhatsApp-Bestellung erneut kopieren kann.
  add column checkout_url text,
  add column out_for_delivery_at timestamptz,
  add column stripe_refund_id text,
  -- Bestellbestätigung an den Kunden (Resend), analog zu sheet_synced_at / notified_at.
  add column confirmation_sent_at timestamptz;
