-- 讓對話訊息的 realtime DELETE 事件能送達前端（rolling 刪最舊圖後即時消失）。
--
-- 坑：Supabase Realtime 的 postgres_changes 也要過 RLS。messages_select 政策用
-- is_conversation_participant(conversation_id) 判權限，但 DELETE 事件的 old record
-- 在預設 replica identity 下「只有主鍵」，拿不到 conversation_id → RLS 無法核可 →
-- 事件被丟棄，client 收不到，桌面端要重整才看得到訊息被刪。
--
-- 改成 FULL：old record 帶完整欄位（含 conversation_id），RLS 得以核可、DELETE 事件送達。
-- 代價：UPDATE/DELETE 的 WAL 會多記整筆 old row，對訊息表寫入量微不足道。
ALTER TABLE public.messages REPLICA IDENTITY FULL;
