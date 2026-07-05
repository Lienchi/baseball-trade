import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/react'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://benjifan.com'),
  title: {
    default: '本質球迷交易所 — 棒球球票 & 周邊交易平台',
    template: '%s｜本質球迷交易所',
  },
  description: '安全、便利的中華職棒球票與周邊商品交易社群',
  openGraph: {
    type: 'website',
    siteName: '本質球迷交易所',
    locale: 'zh_TW',
    title: '本質球迷交易所 — 棒球球票 & 周邊交易平台',
    description: '安全、便利的中華職棒球票與周邊商品交易社群',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const theme = localStorage.getItem('theme')
            if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark')
            }
          } catch {}
        `}} />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-screen bg-chalk pt-16">
            {children}
          </main>
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
