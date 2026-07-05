-- 關注球票：使用者可關注刊登，favorites 為 user x listing 的關聯表
create table public.favorites (
    user_id uuid not null references public.profiles(id) on delete cascade,
    listing_id uuid not null references public.listings(id) on delete cascade,
    created_at timestamp with time zone default now(),
    primary key (user_id, listing_id)
);

create index idx_favorites_listing_id on public.favorites (listing_id);

alter table public.favorites enable row level security;

-- 只能看到 / 新增 / 移除自己的關注
create policy favorites_select on public.favorites for select using (auth.uid() = user_id);
create policy favorites_insert on public.favorites for insert with check (auth.uid() = user_id);
create policy favorites_delete on public.favorites for delete using (auth.uid() = user_id);

grant all on table public.favorites to anon;
grant all on table public.favorites to authenticated;
grant all on table public.favorites to service_role;
