-- 刊登意向：出售或徵求（徵求的球票免附圖，UI 顯示 售/徵 徽章）
-- 既有刊登全部視為出售
alter table public.listings
  add column intent text not null default 'sell'
  check (intent in ('sell', 'wanted'));
