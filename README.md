# ⚾ 球票市集

中華職棒球票 & 周邊商品交易平台

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端框架 | Next.js 14 (App Router) + TypeScript |
| 樣式 | Tailwind CSS |
| 後端 / DB | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| 狀態管理 | Zustand + TanStack React Query |
| 表單驗證 | React Hook Form + Zod |
| 部署 | Vercel |

## 快速開始

### 1. 建立 Supabase 專案

1. 前往 [supabase.com](https://supabase.com) 建立免費帳號
2. 建立新專案
3. 進入 **SQL Editor**，貼上並執行 `supabase/migrations/001_init.sql`
4. 進入 **Storage** → 建立 bucket，命名為 `images`，設為 **Public**
5. 進入 **Settings > API**，複製：
   - `Project URL`
   - `anon public key`

### 2. 設定環境變數

```bash
cp .env.local.example .env.local
```

編輯 `.env.local`，填入上面複製的值：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
```

### 3. 安裝依賴 & 啟動

```bash
npm install
npm run dev
```

開啟 http://localhost:3000

## 專案結構

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/          # 登入頁
│   │   └── register/       # 註冊頁
│   ├── (main)/
│   │   ├── listings/
│   │   │   ├── [id]/       # 貼文詳情
│   │   │   └── new/        # 新增貼文
│   │   ├── messages/
│   │   │   └── [id]/       # 私訊對話
│   │   └── profile/        # 個人頁面
│   ├── auth/callback/      # OAuth 回調
│   ├── layout.tsx
│   └── page.tsx            # 首頁（貼文列表）
├── components/
│   ├── layout/
│   │   └── Navbar.tsx
│   ├── listings/
│   │   ├── ListingCard.tsx
│   │   ├── ListingFiltersBar.tsx
│   │   ├── CommentSection.tsx  # 含 Realtime
│   │   └── ContactSellerButton.tsx
│   └── messages/
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # 瀏覽器端
│   │   └── server.ts       # 伺服器端
│   └── utils.ts
├── types/
│   └── index.ts            # 所有 TypeScript 型別
└── middleware.ts            # 路由保護
```

## 主要功能

### ✅ 已實作
- 用戶認證（Email + Google OAuth）
- 發佈貼文（球票 / 周邊商品）
- 圖片上傳（瀏覽器端壓縮為 WebP）
- 貼文列表 & 篩選（類型、球隊、關鍵字）
- 留言 & 回覆（含 Realtime 即時更新）
- 私訊系統（含圖片傳送 & Realtime）
- 未讀訊息徽章
- 路由保護（未登入重導向）
- RLS 資料安全

### 🚧 待開發（Phase 2）
- [ ] 評分系統
- [ ] 個人頁面
- [ ] 通知中心
- [ ] 收藏 / 追蹤貼文
- [ ] 檢舉機制

### 🔮 進階（Phase 3）
- [ ] 金流整合（綠界 ECPay）
- [ ] LINE Login
- [ ] 推薦算法
- [ ] 手機版 App（React Native）

## 部署到 Vercel

```bash
# 安裝 Vercel CLI
npm i -g vercel

# 部署
vercel

# 設定環境變數（在 Vercel Dashboard 或 CLI）
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## 費用估算

| 階段 | 用戶數 | 每月費用 |
|------|--------|---------|
| 早期 MVP | 0–500 | 約 NT$0–150（網域費） |
| 成長期 | 500–5,000 | 約 NT$750–1,500 |
| 擴展期 | 5,000+ | 約 NT$1,500–4,500 |
