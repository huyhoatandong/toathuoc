-- TOA THUỐC TỰ TÚC - SUPABASE SQL
-- Vào Supabase -> SQL Editor -> New query -> dán toàn bộ file này -> Run

create table if not exists public.patients (
  id bigserial primary key,
  name text not null,
  gender text,
  age text,
  diagnosis text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.medicines (
  id bigserial primary key,
  name text not null unique,
  default_quantity text,
  default_days text,
  default_dose text,
  default_route text,
  default_instruction text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.prescriptions (
  id bigserial primary key,
  patient_id bigint references public.patients(id) on delete set null,
  patient_name text not null,
  gender text,
  age text,
  diagnosis text,
  advice text,
  prescription_date date,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.patients enable row level security;
alter table public.medicines enable row level security;
alter table public.prescriptions enable row level security;

-- App dùng SERVICE_ROLE_KEY ở server nên RLS vẫn an toàn.
-- Không cần policy public nếu chỉ gọi Supabase từ server Node.js.

create index if not exists idx_patients_name on public.patients(name);
create index if not exists idx_medicines_name on public.medicines(name);
create index if not exists idx_prescriptions_created_at on public.prescriptions(created_at desc);
