// Resend 寄信（REST API，不裝 SDK）。只能在 server 端使用。
// RESEND_API_KEY 未設定時靜默跳過（開發環境不寄信）。
const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM = process.env.EMAIL_FROM ?? 'BenjiFan 本質球迷 <notify@benjifan.com>'

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skip sending')
    return false
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })

  if (!res.ok) {
    console.error('[email] send failed', res.status, await res.text())
    return false
  }
  return true
}
