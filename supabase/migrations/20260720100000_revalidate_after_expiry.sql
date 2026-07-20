-- 列表頁 ISR 化（revalidate 86400）後，過期場次的資料清理配套：
-- expire-ticket-listings（台北 00:05）標完 expired 後，00:20 打 /api/revalidate
-- 重建 /tickets 與首頁快取，把過期刊登從快取資料中拿掉。
-- 顯示層另有客端當日過濾雙保險（FilteredListingList），此排程是讓快取資料本身乾淨。

SELECT cron.schedule(
  'revalidate-after-expiry',
  '20 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://benjifan.com/api/revalidate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{"paths":["/tickets","/"]}'::jsonb
  )
  $$
);
