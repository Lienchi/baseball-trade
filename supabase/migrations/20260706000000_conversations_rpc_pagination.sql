-- get_my_conversations 改版：
-- 1. 把最後一則訊息、未讀數直接算進 RPC（原本前端每個對話多發 2 個請求）
-- 2. 依最後訊息時間排序（沒訊息的用對話建立時間）
-- 3. 加 p_limit / p_offset 分頁參數（預設 10 筆，配合前端 infinite scroll）
-- 簽名改變，先 drop 舊的無參數版本，避免 PostgREST 解析歧義

drop function if exists public.get_my_conversations();

create function public.get_my_conversations(p_limit int default 10, p_offset int default 0)
returns table(
  id uuid,
  listing_id uuid,
  created_at timestamptz,
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  listing_title text,
  listing_images text[],
  other_user_id uuid,
  other_username text,
  other_avatar_url text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql stable security definer
set search_path to public
as $$
  select
    c.id,
    c.listing_id,
    c.created_at,
    c.buyer_confirmed_at,
    c.seller_confirmed_at,
    l.title,
    l.images,
    p.id,
    p.username,
    p.avatar_url,
    lm.content,
    lm.created_at,
    coalesce(uc.cnt, 0)
  from conversation_participants cp
  join conversations c on c.id = cp.conversation_id
  left join listings l on l.id = c.listing_id
  join conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id != auth.uid()
  join profiles p on p.id = cp2.user_id
  left join lateral (
    select
      case when m.image_url is not null then '📷 圖片' else m.content end as content,
      m.created_at
    from messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as cnt
    from messages m
    where m.conversation_id = c.id
      and m.is_read = false
      and m.sender_id != auth.uid()
  ) uc on true
  where cp.user_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc
  limit p_limit offset p_offset
$$;

grant execute on function public.get_my_conversations(int, int) to authenticated;
grant execute on function public.get_my_conversations(int, int) to service_role;
