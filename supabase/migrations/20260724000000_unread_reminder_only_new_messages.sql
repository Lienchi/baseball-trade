-- 未讀提醒改為「只提醒上次通知之後才來的新訊息」：
--
-- 舊行為：未讀超過 N 分鐘就提醒，且每對話 24 小時可再寄一封 → 同一則首訊/未讀
--         會被無限（3 天內）重複催促。
-- 新行為：首訊已由 /api/notify/first-message 即時通知，並同步把 conversations.unread_email_at
--         設為當下。cron 只挑「created_at 晚於 unread_email_at」的未讀訊息，也就是
--         上次通知後對方才傳來的新訊息（典型情境：一方回覆、另一方未讀）。
--         寄出後把 unread_email_at 推到當下，同一則訊息不會再被重寄。
-- 仍保留 3 天訊息年齡上限：死掉的對話不翻舊帳。

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
    AND m.created_at > now() - interval '3 days'
    AND (c.unread_email_at IS NULL OR m.created_at > c.unread_email_at)
  GROUP BY m.conversation_id, cp.user_id, c.listing_id
$$;
