-- listing_status 增加下架狀態。
-- enum 新值不能在同一交易內使用，因此獨立成一個 migration，
-- 後續的 policy/trigger/cron 放在下一個檔案。
-- expired：場次全數過期由排程自動標記；removed：管理者手動下架（附原因）。
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'removed';
