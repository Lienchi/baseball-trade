-- 允許登入使用者上傳對話照片到 images bucket 的 messages/{自己的uid}/... 路徑
-- （storage policy 為 permissive OR，加這條不影響既有 listings/avatars 的上傳）
create policy "images_insert_messages_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = 'messages'
  and (storage.foldername(name))[2] = auth.uid()::text
);
