// Brevo 寄信（REST API，不裝 SDK）。只能在 server 端使用。
// BREVO_API_KEY 未設定時靜默跳過（開發環境不寄信）。
// 2026-07-19 與 Auth 信件互換：通知信改走 Brevo（300 封/天），
// Supabase Auth SMTP 改走 Resend（100 封/天）——註冊量遠低於通知量。
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'BenjiFan 本質球迷'
const FROM_EMAIL = process.env.EMAIL_FROM_EMAIL ?? 'notify@benjifan.com'

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    console.warn('[email] BREVO_API_KEY not set, skip sending')
    return false
  }

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    console.error('[email] send failed', res.status, await res.text())
    return false
  }
  return true
}
