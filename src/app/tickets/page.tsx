import { permanentRedirect } from 'next/navigation'

// 球票列表已整併進首頁 tab（預設球票），舊網址永久導回首頁（308，讓 Google 併轉權重）
export default function TicketsPage() {
  permanentRedirect('/')
}
