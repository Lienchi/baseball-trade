-- 修正：交易確認前刪除刊登，對話頁的「關於」與確認按鈕會消失。
-- 原因：seller_id / listing_title 快照在雙方確認時才寫入，而刊登刪除時
-- conversations.listing_id 被 SET NULL，確認前刪掉就查不到賣家與標題。
-- 修法：建立對話時就寫入快照，並讓確認 trigger 在刊登已刪時改用快照。

-- 1. 建立對話時快照賣家與標題（seller 一律取刊登擁有者，與 p_seller_id 無關——
--    該參數語意是「對方的 id」，賣家主動聯絡留言者時對方不是賣家）
CREATE OR REPLACE FUNCTION public.create_conversation(p_listing_id uuid, p_seller_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO public
    AS $$
declare
  v_conv_id uuid;
  v_seller_id uuid;
  v_title text;
begin
  if is_suspended(auth.uid()) then
    raise exception '帳號停權中，無法發起對話';
  end if;

  select user_id, title into v_seller_id, v_title from listings where id = p_listing_id;

  insert into conversations (listing_id, seller_id, listing_title)
  values (p_listing_id, v_seller_id, v_title)
  returning id into v_conv_id;
  insert into conversation_participants (conversation_id, user_id) values (v_conv_id, auth.uid());
  insert into conversation_participants (conversation_id, user_id) values (v_conv_id, p_seller_id);
  return v_conv_id;
end;
$$;

-- 2. 既有對話補快照（刊登還在的都補；刊登已刪且未成交的舊對話無從回溯，維持現狀）
UPDATE public.conversations c
SET seller_id = l.user_id, listing_title = l.title
FROM public.listings l
WHERE l.id = c.listing_id AND c.seller_id IS NULL;

-- 3. 確認成交 trigger：刊登已刪時改用對話上的快照，成交計數與評價不再失效
CREATE OR REPLACE FUNCTION public.handle_mutual_confirmation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO public
    AS $$
declare
  v_listing_id uuid;
  v_seller_id uuid;
  v_buyer_id uuid;
  v_title text;
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
      update profiles set deal_count = deal_count + 1 where id in (v_buyer_id, v_seller_id);

      -- 快照賣家與標題（此 update 會再觸發本 trigger，但 old 已是雙方確認狀態，條件不成立）
      update conversations
      set seller_id = v_seller_id, listing_title = v_title
      where id = new.id;
    end if;
  end if;

  return new;
end;
$$;
