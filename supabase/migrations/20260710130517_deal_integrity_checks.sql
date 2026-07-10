-- 防刷成交次數與星星評價（判定標準隱藏，未達標時靜默不計）：
--   1. 對話門檻：雙方各至少 2 則非系統訊息，未達標 → 不計成交、不可評價
--   2. 同一對使用者成交次數一週最多計 1 次，超過 → 不計成交（仍可評價）
--   3. 星等平均只計每位評價者的最新一則（同一對互刷多次無效）

-- ── 欄位 ──────────────────────────────────────────────
-- 系統訊息（「✅ 已標記交易完成」等）不算進對話門檻
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 雙方確認時由 trigger 寫入判定結果；null = 尚未雙方確認（或修法前的舊資料）
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS deal_counted boolean,
  ADD COLUMN IF NOT EXISTS review_eligible boolean;

-- 修法前已成交的舊對話一律視為有效
UPDATE public.conversations
SET deal_counted = true, review_eligible = true
WHERE buyer_confirmed_at IS NOT NULL
  AND seller_confirmed_at IS NOT NULL
  AND deal_counted IS NULL;

-- ── 雙方確認 trigger：加入判定 ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_mutual_confirmation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO public
    AS $$
declare
  v_listing_id uuid;
  v_seller_id uuid;
  v_buyer_id uuid;
  v_title text;
  v_seller_msgs int;
  v_buyer_msgs int;
  v_threshold_ok boolean;
  v_weekly_ok boolean;
begin
  -- 只在「這次更新後雙方都已確認」且「上一筆狀態不是雙方都確認」時觸發，避免重複計數
  if new.buyer_confirmed_at is not null and new.seller_confirmed_at is not null
     and (old.buyer_confirmed_at is null or old.seller_confirmed_at is null) then

    v_listing_id := new.listing_id;
    select user_id, title into v_seller_id, v_title from listings where id = v_listing_id;
    v_seller_id := coalesce(v_seller_id, new.seller_id);
    v_title := coalesce(v_title, new.listing_title);

    select cp.user_id into v_buyer_id
    from conversation_participants cp
    where cp.conversation_id = new.id and cp.user_id != v_seller_id
    limit 1;

    if v_buyer_id is not null then
      -- 對話門檻：雙方各至少 2 則非系統訊息
      select
        count(*) filter (where sender_id = v_seller_id),
        count(*) filter (where sender_id = v_buyer_id)
      into v_seller_msgs, v_buyer_msgs
      from messages
      where conversation_id = new.id and is_system = false;
      v_threshold_ok := v_seller_msgs >= 2 and v_buyer_msgs >= 2;

      -- 週限：同一對使用者 7 天內已有計入的成交 → 這次不計
      v_weekly_ok := not exists (
        select 1
        from conversations c2
        where c2.id != new.id
          and c2.deal_counted = true
          and greatest(c2.buyer_confirmed_at, c2.seller_confirmed_at) > now() - interval '7 days'
          and exists (select 1 from conversation_participants where conversation_id = c2.id and user_id = v_seller_id)
          and exists (select 1 from conversation_participants where conversation_id = c2.id and user_id = v_buyer_id)
      );

      if v_threshold_ok and v_weekly_ok then
        update profiles set deal_count = deal_count + 1 where id in (v_buyer_id, v_seller_id);
      end if;

      -- 寫回判定結果並快照賣家與標題
      -- （此 update 會再觸發本 trigger，但 old 已是雙方確認狀態，條件不成立）
      update conversations
      set seller_id = v_seller_id,
          listing_title = v_title,
          deal_counted = (v_threshold_ok and v_weekly_ok),
          review_eligible = v_threshold_ok
      where id = new.id;
    end if;
  end if;

  return new;
end;
$$;

-- ── 評價 RPC：未達對話門檻的成交不可評價 ─────────────────
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
  -- 隱藏判定：不透露門檻，回籠統錯誤（null = 舊資料，視為可評價）
  if coalesce(v_conv.review_eligible, true) = false then
    raise exception '此交易目前無法評價';
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

-- ── 星等聚合：每位評價者只計最新一則 ────────────────────
CREATE OR REPLACE FUNCTION public.update_profile_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO public
    AS $$
begin
  update profiles
  set
    rating = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from (
        select distinct on (reviewer_id) rating
        from reviews
        where reviewee_id = new.reviewee_id
        order by reviewer_id, created_at desc
      ) r
    ), 0),
    rating_count = (
      select count(distinct reviewer_id)
      from reviews
      where reviewee_id = new.reviewee_id
    )
  where id = new.reviewee_id;
  return new;
end;
$$;

-- 既有資料以新規則重算一次
UPDATE public.profiles p
SET
  rating = coalesce((
    select round(avg(r.rating)::numeric, 1)
    from (
      select distinct on (reviewer_id) rating
      from public.reviews
      where reviewee_id = p.id
      order by reviewer_id, created_at desc
    ) r
  ), 0),
  rating_count = (
    select count(distinct reviewer_id)
    from public.reviews
    where reviewee_id = p.id
  )
WHERE EXISTS (select 1 from public.reviews where reviewee_id = p.id);
