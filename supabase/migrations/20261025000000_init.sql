-- Pawfolio schema: families (households) own dogs (pets); every record belongs to a pet.
-- Row Level Security on every table: a user sees only rows of the household they belong to.

create extension if not exists pgcrypto;

-- ───────────── Families ─────────────

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  join_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  email text,
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- version 1: a user belongs to one family only
  unique (user_id)
);

-- ───────────── Dogs ─────────────

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  photo_path text,
  breed text,
  birth_date date,
  sex text check (sex in ('female', 'male')),
  neutered boolean,
  chip_number text,
  license_number text,
  license_renewal date,
  allergies text,
  conditions text,
  medications text,
  vet_name text,
  vet_phone text,
  vet_address text,
  emergency_token uuid unique,
  created_at timestamptz not null default now()
);
create index on public.pets (household_id);

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null check (length(trim(type)) > 0),
  given_on date not null,
  next_due date,
  given_by text,
  cost numeric(10,2),
  notes text,
  created_at timestamptz not null default now()
);
create index on public.vaccinations (pet_id, type, given_on desc);

create table public.vet_visits (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  date date not null,
  clinic text,
  reason text not null default '',
  diagnosis text,
  treatment text,
  cost numeric(10,2),
  weight_kg numeric(5,2),
  created_at timestamptz not null default now()
);
create index on public.vet_visits (pet_id, date desc);

create table public.weights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  date date not null,
  kg numeric(5,2) not null check (kg > 0),
  vet_visit_id uuid unique references public.vet_visits(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.weights (pet_id, date);

create table public.food_products (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  brand text not null check (length(trim(brand)) > 0),
  kind text not null default 'dry' check (kind in ('dry', 'wet', 'treats')),
  bag_kg numeric(6,2),
  daily_grams numeric(7,1),
  store text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.food_products (pet_id);

create table public.food_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.food_products(id) on delete cascade,
  date date not null,
  quantity numeric(6,2) not null default 1 check (quantity > 0),
  price numeric(10,2) not null check (price >= 0), -- total paid for this purchase
  store text,
  created_at timestamptz not null default now()
);
create index on public.food_purchases (product_id, date desc);

create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  company text not null check (length(trim(company)) > 0),
  policy_no text,
  coverage_type text,
  yearly_premium numeric(10,2) not null default 0, -- counted as a cost on start_date
  deductible numeric(10,2),
  coverage_cap numeric(10,2),
  start_date date not null,
  renewal_date date,
  created_at timestamptz not null default now()
);
create index on public.insurance_policies (pet_id, start_date desc);

create table public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.insurance_policies(id) on delete cascade,
  vet_visit_id uuid references public.vet_visits(id) on delete set null,
  submitted_on date,
  amount_claimed numeric(10,2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'in_review', 'approved', 'partial', 'rejected', 'paid')),
  status_changed_at timestamptz not null default now(),
  amount_paid numeric(10,2),
  paid_on date,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.insurance_claims (policy_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  date date not null,
  category text not null default 'other'
    check (category in ('grooming', 'equipment', 'toys', 'boarding', 'training', 'license', 'other')),
  amount numeric(10,2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index on public.expenses (pet_id, date desc);

-- Files attached to any record. household_id is stored so RLS and storage paths stay simple.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  entity_type text not null
    check (entity_type in ('vaccination', 'vet_visit', 'food_purchase', 'policy', 'claim', 'expense', 'pet')),
  entity_id uuid not null,
  file_path text not null,
  file_name text,
  mime_type text,
  created_at timestamptz not null default now()
);
create index on public.attachments (entity_type, entity_id);

-- Web Push subscriptions, one row per device.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Reminders already sent, so the daily job never sends the same one twice.
create table public.reminders_sent (
  key text primary key,
  sent_at timestamptz not null default now()
);

-- ───────────── Helper functions ─────────────

-- The current user's household (null when not in a family yet).
create or replace function public.my_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.household_members where user_id = auth.uid()
$$;

create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members where household_id = hid and user_id = auth.uid())
$$;

create or replace function public.can_access_pet(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pets p
    join public.household_members m on m.household_id = p.household_id
    where p.id = pid and m.user_id = auth.uid()
  )
$$;

create or replace function public.new_join_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where join_code = code);
  end loop;
  return code;
end $$;

-- ───────────── Family actions (the only way to create / join / leave) ─────────────

create or replace function public.create_household(p_name text, p_display_name text default null)
returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'already_in_household';
  end if;
  insert into households (name, join_code, created_by)
  values (trim(p_name), new_join_code(), auth.uid()) returning * into h;
  insert into household_members (household_id, user_id, role, display_name, email)
  values (h.id, auth.uid(), 'owner', p_display_name, (select email from auth.users where id = auth.uid()));
  return h;
end $$;

create or replace function public.join_household(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'already_in_household';
  end if;
  select id into hid from households where join_code = upper(trim(p_code));
  if hid is null then raise exception 'invalid_code'; end if;
  insert into household_members (household_id, user_id, role, display_name, email)
  values (hid, auth.uid(), 'member', p_display_name, (select email from auth.users where id = auth.uid()));
  return hid;
end $$;

create or replace function public.regenerate_join_code()
returns text language plpgsql security definer set search_path = public as $$
declare code text; hid uuid;
begin
  select household_id into hid from household_members where user_id = auth.uid() and role = 'owner';
  if hid is null then raise exception 'not_owner'; end if;
  code := new_join_code();
  update households set join_code = code where id = hid;
  return code;
end $$;

create or replace function public.remove_member(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select household_id into hid from household_members where user_id = auth.uid() and role = 'owner';
  if hid is null then raise exception 'not_owner'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_remove_self'; end if;
  delete from household_members where household_id = hid and user_id = p_user_id;
end $$;

-- Leaving: if the last member leaves, the family and all its data are deleted.
-- If the owner leaves while others stay, the longest-standing member becomes owner.
create or replace function public.leave_household()
returns void language plpgsql security definer set search_path = public as $$
declare hid uuid; was_owner boolean;
begin
  select household_id, role = 'owner' into hid, was_owner from household_members where user_id = auth.uid();
  if hid is null then return; end if;
  delete from household_members where user_id = auth.uid();
  if not exists (select 1 from household_members where household_id = hid) then
    delete from households where id = hid;
  elsif was_owner then
    update household_members set role = 'owner'
    where household_id = hid and user_id = (
      select user_id from household_members where household_id = hid order by joined_at limit 1);
  end if;
end $$;

-- Public emergency card: anyone with the token sees the critical info of one dog, nothing else.
create or replace function public.get_emergency_card(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', p.name, 'breed', p.breed, 'birth_date', p.birth_date, 'sex', p.sex,
    'neutered', p.neutered, 'chip_number', p.chip_number, 'license_number', p.license_number,
    'allergies', p.allergies, 'conditions', p.conditions, 'medications', p.medications,
    'vet_name', p.vet_name, 'vet_phone', p.vet_phone, 'vet_address', p.vet_address,
    'photo_path', p.photo_path,
    'owners', (select json_agg(json_build_object('name', m.display_name)) from household_members m
               where m.household_id = p.household_id),
    'vaccinations', (select json_agg(v order by v.type) from (
        select distinct on (type) type, given_on, next_due from vaccinations
        where pet_id = p.id order by type, given_on desc) v)
  )
  from pets p where p.emergency_token = p_token
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on function public.get_emergency_card(uuid) to anon, authenticated;
grant execute on function public.create_household(text, text), public.join_household(text, text),
  public.regenerate_join_code(), public.remove_member(uuid), public.leave_household(),
  public.my_household_id(), public.is_household_member(uuid), public.can_access_pet(uuid)
  to authenticated;

-- Claims: remember when the status last changed (for the "in review over 30 days" reminder).
create or replace function public.touch_claim_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then new.status_changed_at := now(); end if;
  return new;
end $$;
create trigger claims_status_changed before update on public.insurance_claims
  for each row execute function public.touch_claim_status();

-- ───────────── Row Level Security ─────────────

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.pets enable row level security;
alter table public.vaccinations enable row level security;
alter table public.vet_visits enable row level security;
alter table public.weights enable row level security;
alter table public.food_products enable row level security;
alter table public.food_purchases enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.insurance_claims enable row level security;
alter table public.expenses enable row level security;
alter table public.attachments enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminders_sent enable row level security; -- server only, no policies

-- Households: members read; owner renames. Creation only through create_household().
create policy "members read household" on public.households
  for select to authenticated using (public.is_household_member(id));
create policy "owner updates household" on public.households
  for update to authenticated
  using (exists (select 1 from public.household_members m where m.household_id = households.id and m.user_id = auth.uid() and m.role = 'owner'))
  with check (true);
revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;

-- Members: see the rest of the family; each user edits only their own name and notification settings.
create policy "members read members" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));
create policy "member updates self" on public.household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.household_members from authenticated;
grant update (display_name, notify_email, notify_push) on public.household_members to authenticated;

create policy "family manages pets" on public.pets
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Every pet-owned table gets the same rule.
create policy "family manages vaccinations" on public.vaccinations for all to authenticated
  using (public.can_access_pet(pet_id)) with check (public.can_access_pet(pet_id));
create policy "family manages vet_visits" on public.vet_visits for all to authenticated
  using (public.can_access_pet(pet_id)) with check (public.can_access_pet(pet_id));
create policy "family manages weights" on public.weights for all to authenticated
  using (public.can_access_pet(pet_id)) with check (public.can_access_pet(pet_id));
create policy "family manages food_products" on public.food_products for all to authenticated
  using (public.can_access_pet(pet_id)) with check (public.can_access_pet(pet_id));
create policy "family manages insurance_policies" on public.insurance_policies for all to authenticated
  using (public.can_access_pet(pet_id)) with check (public.can_access_pet(pet_id));
create policy "family manages expenses" on public.expenses for all to authenticated
  using (public.can_access_pet(pet_id)) with check (public.can_access_pet(pet_id));

create policy "family manages food_purchases" on public.food_purchases for all to authenticated
  using (exists (select 1 from public.food_products fp where fp.id = product_id and public.can_access_pet(fp.pet_id)))
  with check (exists (select 1 from public.food_products fp where fp.id = product_id and public.can_access_pet(fp.pet_id)));

create policy "family manages insurance_claims" on public.insurance_claims for all to authenticated
  using (exists (select 1 from public.insurance_policies ip where ip.id = policy_id and public.can_access_pet(ip.pet_id)))
  with check (exists (select 1 from public.insurance_policies ip where ip.id = policy_id and public.can_access_pet(ip.pet_id)));

create policy "family manages attachments" on public.attachments for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────── Costs view ─────────────
-- No single "payments" table: every cost stays in its natural place and this view unions them.
-- security_invoker makes the view obey the RLS of the underlying tables.

create view public.costs with (security_invoker = true) as
  select v.pet_id, v.given_on as date, 'vaccinations'::text as category, v.type as label,
         v.cost as amount, 'vaccination'::text as source, v.id as source_id
  from public.vaccinations v where coalesce(v.cost, 0) > 0
  union all
  select vv.pet_id, vv.date, 'vet', coalesce(nullif(vv.reason, ''), vv.clinic, 'ביקור וטרינר'),
         vv.cost, 'vet_visit', vv.id
  from public.vet_visits vv where coalesce(vv.cost, 0) > 0
  union all
  select p.pet_id, f.date, 'food', p.brand, f.price, 'food_purchase', f.id
  from public.food_purchases f join public.food_products p on p.id = f.product_id where f.price > 0
  union all
  select ip.pet_id, ip.start_date, 'insurance', ip.company, ip.yearly_premium, 'policy', ip.id
  from public.insurance_policies ip where ip.yearly_premium > 0
  union all
  select e.pet_id, e.date, 'other', e.category, e.amount, 'expense', e.id
  from public.expenses e where e.amount > 0;

-- Insurance money received back (shown separately; net cost = costs - refunds).
create view public.insurance_refunds with (security_invoker = true) as
  select ip.pet_id, c.paid_on as date, c.amount_paid as amount, c.id as claim_id
  from public.insurance_claims c join public.insurance_policies ip on ip.id = c.policy_id
  where c.amount_paid > 0 and c.paid_on is not null;

grant select on public.costs, public.insurance_refunds to authenticated;

-- ───────────── Storage: one private bucket, folder per household ─────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do nothing;

create policy "family reads files" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "family uploads files" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "family deletes files" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.is_household_member(((storage.foldername(name))[1])::uuid));
