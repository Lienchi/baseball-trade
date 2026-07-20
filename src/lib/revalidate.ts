// 客端寫入成功後呼叫，刷新 ISR 快取（/api/revalidate）。
// 失敗不影響主流程——revalidate 86400 是安全網，最晚一天後自癒。
// 回傳 Promise：接著要 router.refresh() / router.push() 回快取頁的呼叫端
// 應 await，確保拿到的是刷新後的頁面；不在乎時 fire-and-forget 即可。
export function revalidatePaths(...paths: string[]) {
  return fetch('/api/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  }).catch(() => {})
}
