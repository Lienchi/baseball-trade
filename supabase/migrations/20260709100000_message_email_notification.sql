-- 新訊息 email 通知：買家送出首訊時通知賣家（經 /api/notify/first-message + Resend）
-- message_email_enabled：使用者開關（預設開）
-- last_message_email_at：節流用，同一收件人 24 小時內最多一封（由 service role 更新）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS message_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_message_email_at timestamptz;
