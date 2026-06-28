import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: '球票市集 — 棒球球票 & 周邊交易平台',
  description: '安全、便利的中華職棒球票與周邊商品交易社群',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-screen bg-chalk pt-16">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
