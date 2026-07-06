-- 保留使用者名稱：註冊頁原本就查 reserved_usernames 表，但表從未建立（死碼），補上
-- 一律存小寫，比對時用 lower(username)，讓 Admin/ADMIN/admin 都擋得住

create table if not exists public.reserved_usernames (
  username text primary key
);

alter table public.reserved_usernames enable row level security;

drop policy if exists reserved_usernames_select on public.reserved_usernames;
create policy reserved_usernames_select on public.reserved_usernames
  for select using (true);

insert into public.reserved_usernames (username) values
  ('admin'),
  ('administrator'),
  ('moderator'),
  ('root'),
  ('system'),
  ('superuser'),
  ('support'),
  ('官方'),
  ('客服'),
  ('管理者'),
  ('管理員'),
  ('系統管理員'),
  ('本質球迷交易所'),
  ('benjifan')
on conflict do nothing;

-- DB 端也擋（防止繞過前端直接打 auth API 註冊保留名稱）
-- 管理員帳號本身用 SQL update profiles 改名即可，不走這個 trigger
create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer
    set search_path to public
    as $$
declare
  v_username text;
begin
  v_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));

  if exists (
    select 1 from public.reserved_usernames r
    where r.username = lower(v_username)
  ) then
    raise exception 'username is reserved';
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username);
  return new;
end;
$$;
