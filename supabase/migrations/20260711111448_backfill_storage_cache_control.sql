-- 舊檔案補一年 cacheControl：一年快取是 2026-07-11 才上線、只對新上傳生效，
-- 既有檔案仍是預設 max-age=3600，重複下載是 Cached Egress 爆量主因之一。
-- 刊登圖路徑唯一不覆蓋、頭像 URL 帶 ?t= 破快取，長快取無副作用。
update storage.objects
set metadata = jsonb_set(metadata, '{cacheControl}', '"max-age=31536000"')
where bucket_id = 'images'
  and (metadata ->> 'cacheControl' is null or metadata ->> 'cacheControl' = 'max-age=3600');
