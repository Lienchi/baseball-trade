-- 對話照片重新開放 + 儲存空間清理（免費版 Supabase：1GB 儲存 / 5GB egress）
-- 三道機制：
--   ① 每人每對話最多 5 張（rolling，客戶端刪最舊）——需要 messages / storage 的 delete policy
--   ② 已成交滿 3 個月 → 只刪圖，保留文字與評價（cron）
--   ③ 未成交且最後訊息滿 3 個月 → 整段對話刪除（cron）
-- ②③ 需要 conversations.last_message_at 來判定閒置，另由 pg_cron 每日打 API route 執行。
--
-- ⚠️ 部署前置：Vault 的 'cron_secret' 與 Vercel CRON_SECRET 已於未讀提醒 migration 建好，沿用即可。

-- ═══════════════════ ① last_message_at：判定對話閒置 ═══════════════════

-- 預設 now()、NOT NULL，之後永遠有值（含只建立未發言的空對話），cron 過濾不必判 null
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now();

-- backfill：現存對話取最後一則訊息時間，沒有訊息就沿用建立時間
UPDATE public.conversations c
SET last_message_at = COALESCE(
  (SELECT max(m.created_at) FROM public.messages m WHERE m.conversation_id = c.id),
  c.created_at
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON public.conversations (last_message_at);

-- 每則新訊息把所屬對話的 last_message_at 往前推（系統訊息也算「有動靜」）
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_conversation_last_message ON public.messages;
CREATE TRIGGER trg_bump_conversation_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- ═══════════════════ ② rolling 刪除所需 policy ═══════════════════

-- 只允許刪「自己的圖片訊息」——限定 image_url 非空，避免用刪除功能清掉文字對話紀錄（爭議舉證用）
DROP POLICY IF EXISTS messages_delete ON public.messages;
CREATE POLICY messages_delete ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id AND image_url IS NOT NULL);

-- storage：允許刪自己 messages/{uid}/... 底下的物件（對應既有 images_insert_messages_own）
DROP POLICY IF EXISTS "images_delete_messages_own" ON storage.objects;
CREATE POLICY "images_delete_messages_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = 'messages'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ═══════════════════ ③ 清理排程 ═══════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 每天台北 04:00（UTC 20:00）打一次清理 route；實際的圖檔刪除在 route 端用 service role 做
SELECT cron.schedule(
  'cleanup-conversations',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://benjifan.com/api/cron/cleanup-conversations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);
