-- 下架（soft delete）+ 使用者停權（2026-07-09）
-- 依賴上一個 migration 的 listing_status 新值 expired / removed。

-- ═══════════════════ ① 欄位 ═══════════════════

-- 管理者下架紀錄（status = 'removed' 時填寫，給作者看的原因）
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- 停權：suspended_until null = 正常、'infinity' = 無限期；判斷一律用 suspended_until > now()，到期自動失效免排程
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- ═══════════════════ ② 共用判斷函式 ═══════════════════

-- SECURITY DEFINER：policy 內查 profiles 不受 profiles RLS 影響，也避免遞迴
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = uid), false);
$$;

CREATE OR REPLACE FUNCTION public.is_suspended(uid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE((SELECT suspended_until > now() FROM profiles WHERE id = uid), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_suspended(uuid) FROM PUBLIC, anon;

-- ═══════════════════ ③ 保護欄位 trigger ═══════════════════

-- profiles：is_admin / suspended_* 只有管理者能改。
-- 同時堵住既有漏洞：原本本人可 UPDATE 自己整列，包含把 is_admin 改成 true。
CREATE OR REPLACE FUNCTION public.protect_profile_admin_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin
      OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until
      OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
      OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at)
     AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '此欄位僅限管理員修改';
  END IF;
  -- 管理者也不能改自己的 is_admin / 停權自己（防誤操作把唯一管理員鎖掉）
  IF auth.uid() = OLD.id
     AND (NEW.is_admin IS DISTINCT FROM OLD.is_admin
          OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until) THEN
    RAISE EXCEPTION '不能修改自己的管理員／停權狀態';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_admin_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_protect_profile_admin_columns ON public.profiles;
CREATE TRIGGER on_protect_profile_admin_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_columns();

-- listings：removed 狀態只有管理者能設定/解除，作者不能自行把被下架的文章改回 active
CREATE OR REPLACE FUNCTION public.protect_removed_status() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF (OLD.status = 'removed') IS DISTINCT FROM (NEW.status = 'removed')
     AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '下架狀態僅限管理員變更';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_removed_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_protect_removed_status ON public.listings;
CREATE TRIGGER on_protect_removed_status
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.protect_removed_status();

-- ═══════════════════ ④ RLS policy 調整 ═══════════════════

-- 管理者可 UPDATE 任何 profile（停權用）；一般人維持只能改自己
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- listings SELECT：
--   一般訪客 → 只看 active 且賣家未停權（停權者的刊登全站隱藏）
--   作者本人 → 看得到自己所有狀態（含被下架的，附原因）
--   管理者   → 全部看得到
DROP POLICY listings_select ON public.listings;
CREATE POLICY listings_select ON public.listings FOR SELECT
  USING (
    (status = 'active' AND NOT public.is_suspended(user_id))
    OR auth.uid() = user_id
    OR public.is_admin(auth.uid())
  );

-- 停權者禁止：發文、留言、發訊息、開對話、評價（DB 層強制，前端擋不算數）
DROP POLICY listings_insert ON public.listings;
CREATE POLICY listings_insert ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id)
    AND NOT public.is_suspended(auth.uid())
  );

DROP POLICY conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_suspended(auth.uid()));

-- 評價沒有 insert policy（只能走 submit_review RPC），停權檢查加在 RPC 開頭
CREATE OR REPLACE FUNCTION public.submit_review(
  p_conversation_id uuid,
  p_rating integer,
  p_comment text DEFAULT null
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO public
    AS $$
declare
  v_conv conversations%rowtype;
  v_reviewee uuid;
begin
  if is_suspended(auth.uid()) then
    raise exception '帳號停權中，無法評價';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  select * into v_conv from conversations where id = p_conversation_id;
  if v_conv.id is null then
    raise exception 'conversation not found';
  end if;
  if v_conv.buyer_confirmed_at is null or v_conv.seller_confirmed_at is null then
    raise exception 'deal not completed yet';
  end if;
  if not exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'not a participant';
  end if;

  select user_id into v_reviewee
  from conversation_participants
  where conversation_id = p_conversation_id and user_id != auth.uid()
  limit 1;

  -- 重複評價由 reviews_reviewer_conversation_key unique 擋下
  insert into reviews (reviewer_id, reviewee_id, conversation_id, listing_id, listing_title, rating, comment)
  values (
    auth.uid(),
    v_reviewee,
    p_conversation_id,
    v_conv.listing_id,
    coalesce(v_conv.listing_title, (select title from listings where id = v_conv.listing_id)),
    p_rating,
    nullif(trim(p_comment), '')
  );
end;
$$;

-- ═══════════════════ ⑤ 每日過期排程 ═══════════════════

-- 球票最晚場次已過（台北時區）→ 標 expired 釋放上架名額。
-- 列表的「即時消失」由查詢端日期過濾負責，排程只是把狀態固定下來。
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 台北 00:05 = UTC 16:05
SELECT cron.schedule(
  'expire-ticket-listings',
  '5 16 * * *',
  $$
  UPDATE public.listings
  SET status = 'expired'
  WHERE status = 'active'
    AND last_game_date IS NOT NULL
    AND last_game_date < (now() AT TIME ZONE 'Asia/Taipei')::date
  $$
);

-- 過期判斷用的 partial index（列表查詢也吃得到）
CREATE INDEX IF NOT EXISTS idx_listings_active_last_game_date
  ON public.listings (last_game_date)
  WHERE status = 'active';
