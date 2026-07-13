-- 註冊表單雖有 minLength/maxLength(2-20)，但 anon key 可繞過表單直接打 auth.signUp
-- 塞任意長度的 username，DB 端補驗證：trim 後長度 2-20（trim 順便擋純空白名稱）

create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer
    set search_path to public
    as $$
declare
  v_username text;
begin
  v_username := trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));

  if char_length(v_username) < 2 or char_length(v_username) > 20 then
    raise exception 'username must be 2-20 characters';
  end if;

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
