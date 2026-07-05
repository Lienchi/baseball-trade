-- 場次級關注：favorites 加 item_id（null = 關注整篇刊登，有值 = 關注 ticket_items 裡特定場次）
-- PK 不能含 nullable 欄位，改用 surrogate id + 唯一索引（item_id null 以固定 uuid 代替參與唯一性檢查）
alter table public.favorites add column item_id uuid;
alter table public.favorites drop constraint favorites_pkey;
alter table public.favorites add column id uuid default extensions.uuid_generate_v4() not null primary key;
create unique index favorites_user_listing_item_key
  on public.favorites (user_id, listing_id, coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 既有刊登的 ticket_items 補上穩定 id（之後由前端在新增/編輯時生成，已有 id 的不動）
update public.listings
set ticket_items = (
  select jsonb_agg(
    case when item ? 'id' then item
         else item || jsonb_build_object('id', extensions.uuid_generate_v4())
    end
  )
  from jsonb_array_elements(ticket_items) as item
)
where jsonb_array_length(ticket_items) > 0;
