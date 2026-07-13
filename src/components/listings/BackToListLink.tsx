'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface Props {
  href: string
  label: string
}

/** 站內導航來的用 history.back() 保留列表篩選與捲動位置；分享連結落地（referrer 非本站）則導去列表 */
export function BackToListLink({ href, label }: Props) {
  const router = useRouter()

  const goBack = (e: React.MouseEvent) => {
    e.preventDefault()
    const fromInside = document.referrer.startsWith(window.location.origin)
    if (fromInside && window.history.length > 1) {
      router.back()
    } else {
      router.push(href)
    }
  }

  return (
    <a
      href={href}
      onClick={goBack}
      className="mb-4 inline-flex items-center gap-0.5 text-sm text-dugout transition hover:text-scoreboard"
    >
      <ChevronLeft size={16} />
      {label}
    </a>
  )
}
