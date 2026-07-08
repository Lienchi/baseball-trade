-- 球隊改必填：既有 NULL 補成「其他」，並加 NOT NULL（前端表單已同步改為必選）
UPDATE listings
SET team = '其他'
WHERE team IS NULL;

ALTER TABLE listings
  ALTER COLUMN team SET NOT NULL;
