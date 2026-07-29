-- show_social_on_listings：刊登詳情頁是否顯示賣家社群 icon（預設開）
-- 帳號本身在個人頁一直是公開的，這個開關只控制刊登頁的曝光
alter table public.profiles
  add column if not exists show_social_on_listings boolean not null default true;
