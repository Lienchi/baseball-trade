-- 修正：is_admin / is_suspended 被 listings_select 等 RLS policy 引用，
-- policy 內的函式以「查詢者」身分執行，anon（未登入瀏覽）也需要 EXECUTE，
-- 前一個 migration 收掉 anon 會讓公開列表直接 permission denied。
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO anon, authenticated;
