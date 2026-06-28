import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // 球隊代表色是透過 getTeamColor() 動態組合出 class 字串（例如 bg-uni、border-fubon），
  // Tailwind 靜態掃描抓不到這種動態組合，必須明確列在 safelist 才會被編譯進最終 CSS
  safelist: [
    'bg-brother', 'text-brother', 'border-brother',
    'bg-uni', 'text-uni', 'border-uni',
    'bg-fubon', 'text-fubon', 'border-fubon',
    'bg-rakuten', 'text-rakuten', 'border-rakuten',
    'bg-wei', 'text-wei', 'border-wei',
    'bg-tsg', 'text-tsg', 'border-tsg',
    'bg-dugout', 'text-dugout', 'border-dugout',
    'text-white', 'text-scoreboard',
  ],
  theme: {
    extend: {
      colors: {
        field: {
          DEFAULT: '#1E5FA8',  // 主色：藍色
          light: '#2C72C4',
          dark: '#154780',
        },
        clay: {
          DEFAULT: '#C8472E',  // 紅土橘紅 — CTA / 強調
          light: '#D9603F',
          dark: '#A8381F',
        },
        chalk: '#F7F4ED',       // 壘線白 — 背景
        scoreboard: '#15191C',  // 計分板黑 — 主要文字
        dugout: '#5B6760',      // 休息區墨綠 — 次要文字
        gold: '#D4A437',        // 冠軍金 — 評分 / 稀有強調

        // 中華職棒六隊代表色
        brother: '#F2C12E',     // 中信兄弟 — 黃色
        uni: '#E8762C',         // 統一7-ELEVEn獅 — 橘色
        fubon: '#0F3D6E',       // 富邦悍將 — 深藏青藍（與主色區隔）
        rakuten: '#7A1F2B',     // 樂天桃猿 — 暗紅色
        wei: '#C0392B',         // 味全龍 — 紅色
        tsg: '#1E7B4D',         // 台鋼雄鷹 — 綠色
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'stitch-pattern': "repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.03) 8px, rgba(255,255,255,0.03) 9px)",
      },
    },
  },
  plugins: [],
}
export default config
