-- 修正：participants_select policy 的子查詢引用自身資料表，觸發 RLS 無限遞迴，
-- 導致前端查「對話另一位參與者」失敗（對話頁標頭的對方資訊顯示不出來）。
-- 改用 SECURITY DEFINER helper（conversations_select 本來就是這個寫法）。
DROP POLICY participants_select ON public.conversation_participants;
CREATE POLICY participants_select ON public.conversation_participants FOR SELECT
  USING (public.is_conversation_participant(conversation_id));
