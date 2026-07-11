-- 球票日期範圍搜尋精準化：以 ticket_items 內每一個實際場次日期判斷，
-- 而非 [game_date, last_game_date] 區間重疊——多場次刊登（如 7/10、9/17）
-- 的中間空檔（8/1~8/5）不應被搜到。
-- 作為 PostgREST computed column 使用：/listings?game_dates=ov.{...}
create or replace function public.game_dates(l public.listings)
returns date[]
language sql
stable
set search_path = ''
as $$
  select coalesce(
    array_agg((item->>'date')::date),
    '{}'::date[]
  )
  from jsonb_array_elements(l.ticket_items) as item
  where coalesce(item->>'date', '') <> ''
$$;
