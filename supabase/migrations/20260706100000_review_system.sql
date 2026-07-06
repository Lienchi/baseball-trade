-- 評價系統改版：
-- 1) 雙方確認交易完成 = profiles.deal_count（成交次數）+1，不再自動塞 5 星假評價
-- 2) 成交後雙方可各給一次 1–5 星評分 + 評語（submit_review RPC）
-- 3) 評價改掛在 conversation 上，之後刊登被清除也不會弄丟評價
-- 4) 舊資料轉移：原本的自動 5 星 reviews 全是「成交次數」的替身，轉成 deal_count 後刪除

-- ── 欄位調整 ────────────────────────────────────────────────

alter table public.profiles
  add column if not exists deal_count integer not null default 0;

-- conversations 快照欄位：刊登刪除後，對話頁仍知道賣家是誰、賣的是什麼（雙方確認時寫入）
alter table public.conversations
  add column if not exists seller_id uuid references public.profiles(id) on delete set null;
alter table public.conversations
  add column if not exists listing_title text;

-- reviews 改以 conversation 為單位：一個對話（一筆交易）每人只能評一次
alter table public.reviews
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.reviews
  add column if not exists listing_title text;
alter table public.reviews alter column listing_id drop not null;

-- 刊登刪除時保留評價（原本是 cascade，會把評價一起刪掉）
alter table public.reviews drop constraint if exists reviews_listing_id_fkey;
alter table public.reviews
  add constraint reviews_listing_id_fkey
  foreign key (listing_id) references public.listings(id) on delete set null;

alter table public.reviews drop constraint if exists reviews_reviewer_id_listing_id_key;
alter table public.reviews drop constraint if exists reviews_reviewer_conversation_key;
alter table public.reviews
  add constraint reviews_reviewer_conversation_key unique (reviewer_id, conversation_id);

create index if not exists idx_reviews_reviewee_id on public.reviews (reviewee_id, created_at desc);

-- ── 舊資料轉移 ──────────────────────────────────────────────

-- 目前 reviews 全是雙方確認時自動塞的 5 星（沒有 UI 可手動評價），
-- 其筆數就是成交次數：轉入 deal_count 後清空，重新開始累積真實評價
update public.profiles p set deal_count = (
  select count(*) from public.reviews r where r.reviewee_id = p.id
);
delete from public.reviews;
update public.profiles set rating = 0, rating_count = 0;

-- 已成交的舊對話補上快照，讓之後刊登刪除不影響對話頁
update public.conversations c
set seller_id = l.user_id, listing_title = l.title
from public.listings l
where l.id = c.listing_id
  and c.buyer_confirmed_at is not null
  and c.seller_confirmed_at is not null
  and c.seller_id is null;

-- ── 雙方確認後的處理：成交 +1、寫快照 ───────────────────────
-- 注意：不動 listings.status——一篇刊登可能有多個品項、同時跟多個買家成交，
-- 賣掉哪些品項只有賣家知道，由賣家用「標記售出」自行管理

create or replace function public.handle_mutual_confirmation() returns trigger
    language plpgsql security definer
    set search_path to public
    as $$
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

-- ── 評分 RPC：成交後雙方可各給一次 1–5 星 + 評語 ─────────────

create or replace function public.submit_review(
  p_conversation_id uuid,
  p_rating integer,
  p_comment text default null
) returns void
    language plpgsql security definer
    set search_path to public
    as $$
declare
  v_conv conversations%rowtype;
  v_reviewee uuid;
begin
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

grant execute on function public.submit_review(uuid, integer, text) to authenticated;

-- 評價只能走 RPC（security definer 不受 RLS 限制），關掉直接 insert
drop policy if exists reviews_insert on public.reviews;
