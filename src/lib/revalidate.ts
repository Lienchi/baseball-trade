// 客端寫入成功後呼叫，fire-and-forget 刷新 ISR 快取（/api/revalidate）。
// 失敗不影響主流程——revalidate 86400 是安全網，最晚一天後自癒。
export function revalidatePaths(...paths: string[]) {
  fetch('/api/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  }).catch(() => {})
}
