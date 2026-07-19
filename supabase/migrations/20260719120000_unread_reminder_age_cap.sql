-- 未讀提醒加訊息年齡上限：
-- 1. 只提醒 3 天內的訊息——對話死了就不再翻舊帳，也讓「永遠不讀」的對話
--    最多被提醒 2~3 次後自然停止（原設計每 24 小時會無限重寄）。
-- 2. 硬性下限 2026-07-19 11:10 UTC（功能上線時刻）：上線前累積的 48 則未讀
--    永久排除，不因 24 小時節流到期而觸發。3 天後此下限自然失效。

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
    AND m.created_at > greatest(now() - interval '3 days', timestamptz '2026-07-19 11:10+00')
    AND (c.unread_email_at IS NULL OR c.unread_email_at < now() - interval '24 hours')
  GROUP BY m.conversation_id, cp.user_id, c.listing_id
$$;
