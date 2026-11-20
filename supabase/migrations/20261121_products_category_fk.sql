-- Replace the hard-coded `category` enum on products with a real foreign key
-- to the categories table, so categories added on the Categories page can be
-- assigned to products, and categories still in use cannot be deleted.
--
-- Run in the Supabase SQL Editor. Everything in the transaction is applied
-- together or not at all.

begin;

-- 1. Make sure every category already used (or allowed) by products exists
--    in the categories table, so the foreign key can be created.
insert into public.categories (name)
select label::text
from unnest(enum_range(null::public.category)) as label
on conflict (name) do nothing;

insert into public.categories (name)
select distinct category::text
from public.products
where category is not null
on conflict (name) do nothing;

-- 2. Drop the CHECK constraint that limits category to the 7 enum values.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.products drop constraint %I', r.conname);
  end loop;
end $$;

-- 3. Change the column from the enum type to plain text (values are kept).
alter table public.products
  alter column category type text using category::text;

-- 4. Link products.category to categories.name.
--    ON UPDATE CASCADE: renaming a category updates its products.
--    ON DELETE RESTRICT: a category that still has products cannot be deleted.
alter table public.products
  add constraint products_category_fkey
  foreign key (category) references public.categories (name)
  on update cascade
  on delete restrict;

create index if not exists products_category_idx on public.products (category);

commit;

-- 5. (Optional) Remove the old enum type once nothing uses it.
--    If this fails with "cannot drop type ... because other objects depend on it",
--    some database function still references the type; it is safe to leave it.
-- drop type public.category;

-- Verify:
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.products'::regclass and contype = 'f';
