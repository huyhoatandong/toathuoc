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


create table if not exists public.doctors (
  id bigserial primary key,
  username text not null unique,
  password_hash text not null,
  full_name text not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.doctors enable row level security;

-- Tài khoản mặc định:
-- username: huy
-- password: 123456
-- Bạn nên đổi mật khẩu sau khi deploy.
insert into public.doctors (username, password_hash, full_name, title, is_admin)
values (
  'huy',
  '$2a$10$7QJ8qsP6Qz39wmudGAW2ZegVKLnIpJJlC4hOnBQulO7sSxubZ50Yq',
  'NGUYỄN QUỐC HUY',
  'BS CKI.',
  true
)
on conflict (username) do nothing;

alter table public.prescriptions
add column if not exists doctor_id bigint references public.doctors(id) on delete set null;

alter table public.prescriptions
add column if not exists doctor_name text;

alter table public.prescriptions
add column if not exists doctor_title text;


alter table public.doctors
add column if not exists is_admin boolean default false;

update public.doctors
set is_admin = true
where username = 'huy';
