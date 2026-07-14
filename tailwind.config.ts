import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // 球隊代表色是透過 getTeamColor() 動態組合出 class 字串（例如 bg-uni、border-fubon），
  // Tailwind 靜態掃描抓不到這種動態組合，必須明確列在 safelist 才會被編譯進最終 CSS
  safelist: [
    'bg-brother', 'border-brother',
    'bg-uni', 'border-uni',
    'bg-fubon', 'border-fubon',
    'bg-rakuten', 'border-rakuten',
    'bg-wei', 'border-wei',
    'bg-tsg', 'border-tsg',
    'bg-dugout', 'border-dugout',
    'text-white', 'text-black',
  ],
  theme: {
    extend: {
      colors: {
        field: {
          DEFAULT: '#0D3B66',  // 主色：深藏青藍（參考富邦悍將視覺）
          light: '#1957A6',
          dark: '#082849',
        },
        banner: '#1E6FD9',     // 頂部橫幅：藍色底
        clay: {
          DEFAULT: '#154C99',  // CTA / 強調藍（深）
          light: '#1E6FD9',
          dark: '#0D3B78',
        },
        chalk: 'rgb(var(--color-chalk) / <alpha-value>)',
        scoreboard: 'rgb(var(--color-scoreboard) / <alpha-value>)',
        dugout: 'rgb(var(--color-dugout) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        gold: {
          DEFAULT: '#D4A437',  // 冠軍金 — 評分 / 稀有強調
          dark: '#9A7420',     // 深金 — 淺色底上需要更高對比時（如徵求徽章）
        },

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
