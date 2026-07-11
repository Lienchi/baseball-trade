import type { Metadata } from 'next'
import { Archivo, Archivo_Black, JetBrains_Mono, Noto_Sans_TC } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/react'

// next/font 自動 self-host 字型（取代 globals.css 的 @import，不阻塞渲染）。
// Noto Sans TC 補上 Archivo 缺的中文字形，經 CSS 變數串成 fallback。
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
})
const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-archivo-black',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})
const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-tc',
  display: 'swap',
  preload: false,
})

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
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={`${archivo.variable} ${archivoBlack.variable} ${jetbrainsMono.variable} ${notoSansTC.variable}`}
    >
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
            <AnnouncementBanner />
            {children}
          </main>
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
