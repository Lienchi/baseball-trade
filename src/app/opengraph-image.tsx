import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '本質球迷交易所 — 棒球球票 & 周邊交易平台'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// next/og 預設字型不含 CJK，需在執行時載入涵蓋圖中文字的 Noto Sans TC 子集
async function loadNotoSansTC(text: string): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text=${encodeURIComponent(text)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  ).then(res => res.text())

  const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
  if (!fontUrl) throw new Error('無法取得 Noto Sans TC 字型')

  return fetch(fontUrl).then(res => res.arrayBuffer())
}

export default async function OgImage() {
  const fontData = await loadNotoSansTC('本質球迷交易所中華職棒票與周邊商品社群BENJIFANEXCHANGE ')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d3560 0%, #082849 100%)',
          color: '#F5F0E8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', position: 'relative', width: 120, height: 136 }}>
            <svg width="120" height="136" viewBox="0 0 60 68">
              <path d="M 30 2 L 56 10 L 56 34 Q 56 54 30 66 Q 4 54 4 34 L 4 10 Z" fill="#082849" stroke="#D4A437" strokeWidth="2" />
              <path d="M 30 9 L 49 15 L 49 34 Q 49 48 30 58 Q 11 48 11 34 L 11 15 Z" fill="none" stroke="#D4A437" strokeWidth="1" opacity="0.6" />
            </svg>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 120,
                height: 124,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 52,
                fontWeight: 900,
                color: '#F5F0E8',
              }}
            >
              本
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 68, fontWeight: 700, color: '#F5F0E8' }}>本質球迷交易所</div>
            <div style={{ fontSize: 24, marginTop: 12, letterSpacing: 6, color: '#D4A437' }}>
              BENJI FAN EXCHANGE
            </div>
          </div>
        </div>
        <div style={{ fontSize: 30, marginTop: 40, color: '#c9d6e3' }}>
          中華職棒球票與周邊商品交易社群
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Noto Sans TC', data: fontData, weight: 700, style: 'normal' }],
    }
  )
}
