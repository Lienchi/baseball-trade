-- 復原 20260729000000：刊登頁社群 icon 最後決定不做開關，一律顯示，欄位沒人用了
alter table public.profiles
  drop column if exists show_social_on_listings;
