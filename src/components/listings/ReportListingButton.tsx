'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { REPORT_REASONS, type ReportReason } from '@/lib/report'

interface Props {
  listingId: string
  initialReported: boolean
}

// 檢舉刊登：低調的文字按鈕＋原因彈窗。送出走 /api/report（檢查都在 server 端），
// 同一人對同一刊登只算一次；刊登頁與賣家看不到任何檢舉痕跡。
export function ReportListingButton({ listingId, initialReported }: Props) {
  const [reported, setReported] = useState(initialReported)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0])
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (reported) {
    return (
      <p className="mt-3 flex items-center justify-center gap-1 text-xs text-dugout/60">
        <Flag size={12} /> 已檢舉此刊登
      </p>
    )
  }

  const submit = async () => {
    setError('')
    if (reason === '其他' && !detail.trim()) {
      setError('選擇「其他」時請填寫說明')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, reason, detail: detail.trim() }),
    })
    setSubmitting(false)
    if (res.ok) {
      setReported(true)
      setOpen(false)
    } else {
      setError('檢舉送出失敗，請稍後再試')
    }
  }

  return (
    <>
      <button
        className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-dugout/60 hover:text-dugout hover:underline"
        onClick={() => setOpen(true)}
      >
        <Flag size={12} /> 檢舉此刊登
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scoreboard/50 p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-scoreboard">檢舉此刊登</h2>
            <p className="mt-1 text-sm text-dugout">檢舉內容僅管理員可見，經查證屬實將依網站規定處理</p>

            <div className="mt-3 space-y-2">
              {REPORT_REASONS.map(r => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-scoreboard">
                  <input
                    type="radio"
                    name="report-reason"
                    className="accent-field"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {r}
                </label>
              ))}
            </div>

            <textarea
              className="input mt-3 w-full resize-none"
              rows={3}
              maxLength={300}
              placeholder={reason === '其他' ? '請說明檢舉原因（必填）' : '補充說明（選填）'}
              value={detail}
              onChange={e => setDetail(e.target.value)}
            />
            {error && <p className="mt-1 text-xs text-clay-dark">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md px-4 py-1.5 text-sm text-dugout hover:bg-dugout/10"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                取消
              </button>
              <button
                className="rounded-md bg-field px-4 py-1.5 text-sm font-bold text-white hover:bg-field/90 disabled:opacity-60"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? '送出中...' : '送出檢舉'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
