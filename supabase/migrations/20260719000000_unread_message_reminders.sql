-- 未讀私訊 email 提醒：pg_cron 每 15 分打 /api/cron/unread-reminders，
-- 由 API route 查候選對話、經 Resend 寄信。
-- 條件：未讀非系統訊息超過 N 分鐘（route 端 UNREAD_REMINDER_MINUTES，預設 30）。
-- 節流：conversations.unread_email_at，每對話 24 小時最多一封。
--
-- ⚠️ 部署前置作業（dashboard 手動）：
--   1. Vault 新增 secret：name = 'cron_secret'，值與 Vercel 環境變數 CRON_SECRET 相同
--   2. Vercel 設定 CRON_SECRET

-- ═══════════════════ ① 節流欄位＋backfill ═══════════════════

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS unread_email_at timestamptz;

-- backfill：現存已有未讀的對話視為「已提醒過」，避免首跑對舊未讀轟炸
UPDATE public.conversations c
SET unread_email_at = now()
WHERE unread_email_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = c.id AND m.is_read = false AND m.is_system = false
  );

-- ═══════════════════ ② 候選查詢 function（僅 service role 用） ═══════════════════

CREATE OR REPLACE FUNCTION public.get_unread_reminder_candidates(p_minutes int DEFAULT 30)
RETURNS TABLE(conversation_id uuid, recipient_id uuid, listing_id uuid, unread_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.conversation_id,
         cp.user_id AS recipient_id,
         c.listing_id,
         count(*) AS unread_count
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  JOIN public.conversation_participants cp
    ON cp.conversation_id = m.conversation_id AND cp.user_id <> m.sender_id
  WHERE m.is_read = false
    AND m.is_system = false
    AND m.created_at < now() - make_interval(mins => p_minutes)
    AND (c.unread_email_at IS NULL OR c.unread_email_at < now() - interval '24 hours')
  GROUP BY m.conversation_id, cp.user_id, c.listing_id
$$;

REVOKE EXECUTE ON FUNCTION public.get_unread_reminder_candidates(int) FROM PUBLIC, anon, authenticated;

-- ═══════════════════ ③ 排程 ═══════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 每 15 分打一次 API route；secret 從 Vault 讀，不落地 repo
SELECT cron.schedule(
  'unread-message-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://benjifan.com/api/cron/unread-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- cron 執行紀錄只留 7 天，避免 job_run_details 無限長大（台北 01:00 = UTC 17:00）
SELECT cron.schedule(
  'cleanup-cron-history',
  '0 17 * * *',
  $$
  DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'
  $$
);
