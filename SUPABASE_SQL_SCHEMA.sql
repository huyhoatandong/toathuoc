-- TOA THUỐC TỰ TÚC - SUPABASE SQL V8
-- Login chỉ bằng mã bác sĩ 4 số, không cần mật khẩu.
-- Mã mặc định: 1789

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

create table if not exists public.doctors (
  id bigserial primary key,
  username text not null unique,
  password_hash text default '',
  full_name text not null,
  title text,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.doctors add column if not exists password_hash text default '';
alter table public.doctors add column if not exists is_admin boolean default false;

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
  doctor_id bigint references public.doctors(id) on delete set null,
  doctor_name text,
  doctor_title text,
  created_at timestamptz default now()
);

alter table public.prescriptions add column if not exists doctor_id bigint references public.doctors(id) on delete set null;
alter table public.prescriptions add column if not exists doctor_name text;
alter table public.prescriptions add column if not exists doctor_title text;

alter table public.patients enable row level security;
alter table public.medicines enable row level security;
alter table public.doctors enable row level security;
alter table public.prescriptions enable row level security;

create index if not exists idx_patients_name on public.patients(name);
create index if not exists idx_medicines_name on public.medicines(name);
create index if not exists idx_prescriptions_created_at on public.prescriptions(created_at desc);
create index if not exists idx_doctors_username on public.doctors(username);

insert into public.doctors (username, password_hash, full_name, title, is_admin)
values ('1789', '', 'NGUYỄN QUỐC HUY', 'BS CKI.', true)
on conflict (username) do update
set password_hash='', full_name=excluded.full_name, title=excluded.title, is_admin=true, updated_at=now();

insert into public.medicines (name, default_quantity, default_days, default_dose, default_route, default_instruction)
values
('Paracetamol 500mg','10 viên','3','1 viên','Uống sau ăn','Khi đau/sốt'),
('Omeprazol 20mg','14 viên','1','1 viên','Uống trước ăn 30 phút',''),
('Cefixim 200mg','10 viên','2','1 viên','Uống sau ăn','')
on conflict (name) do nothing;
