-- 個人頁社群帳號：{"threads": "handle", "instagram": "handle"}
-- 只存 handle（前端白名單驗證），顯示時由程式組出網址，不存自由 URL
alter table public.profiles add column if not exists social_links jsonb;
