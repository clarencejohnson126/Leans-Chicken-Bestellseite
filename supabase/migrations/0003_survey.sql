-- Kurze Umfrage zum Pop-up-Testlauf: Wunschtage, Uhrzeiten, Bestellhäufigkeit und ein freier Tipp.
-- Anonym: keine Namen, Kontaktdaten oder IP-Adressen. Nur der Server schreibt (Service Role).

create table leans.survey_responses (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null default '{}'::jsonb,   -- {"days": ["fr"], "times": ["abends"], ...}, IDs aus config/survey.ts
  tip text not null default '' check (char_length(tip) <= 1000),
  created_at timestamptz not null default now()
);
create index survey_responses_created_idx on leans.survey_responses (created_at desc);

alter table leans.survey_responses enable row level security;
grant all on leans.survey_responses to service_role;
