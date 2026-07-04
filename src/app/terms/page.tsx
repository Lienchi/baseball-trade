import type { Metadata } from 'next'
import TermsContent from '@/components/TermsContent'

export const metadata: Metadata = {
  title: '網站規定與免責聲明 — 本質球迷交易所',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <TermsContent />
    </div>
  )
}
