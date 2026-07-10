// 社群帳號只存 handle，顯示時組網址（見 lib/utils 的 SOCIAL_PLATFORMS）
export interface SocialLinks {
  threads?: string
  instagram?: string
  line?: string
}

export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  social_links: SocialLinks | null
  rating: number        // 平均星等（1–5，無評價時為 0）
  rating_count: number  // 收到的評價數
  deal_count: number    // 完成交易次數（雙方確認後 +1）
  is_admin?: boolean
  suspended_until: string | null   // null=正常；'infinity'=無限期；判斷用 suspended_until > now()
  suspended_reason: string | null
  message_email_enabled?: boolean       // 新訊息 email 通知開關（預設開）
  last_message_email_at?: string | null // 通知節流：24 小時內最多一封
  created_at: string
}

export type ListingType = 'ticket' | 'merchandise'
// expired：場次全數過期（pg_cron 每日標記，顯示端另以日期即時判斷）
// removed：管理者下架（removed_reason 給作者看）；只有管理者能設定/解除
export type ListingStatus = 'active' | 'sold' | 'closed' | 'expired' | 'removed'
export type DealMethod = 'meetup' | 'mail' | 'eticket' | 'app_transfer'

export const DEAL_METHOD_LABELS: Record<DealMethod, string> = {
  meetup: '面交',
  mail: '郵寄',
  eticket: '電子票券',
  app_transfer: 'APP轉票',
}

// 各刊登類型可選的交易方式（電子票券/APP轉票 僅適用於球票）
export const DEAL_METHOD_OPTIONS: Record<ListingType, DealMethod[]> = {
  ticket: ['app_transfer', 'meetup', 'mail', 'eticket'],
  merchandise: ['meetup', 'mail'],
}

// 同時上架（active）數量上限，防黃牛/洗版；DB 端另有 trigger 強制
export const LISTING_LIMITS: Record<ListingType, number> = {
  ticket: 3,
  merchandise: 3,
}

// 單篇刊登可包含的品項上限（球票場次 / 周邊商品共用）
export const MAX_ITEMS_PER_LISTING = 5

// 球票場次 / 周邊商品：一篇刊登可包含多筆品項。球票用 date+seat，周邊用 name，共用同一個 ticket_items 欄位
export interface TicketItem {
  id?: string   // 穩定識別碼（場次級關注用）；舊資料可能沒有，由 migration 補齊、表單送出時生成
  date?: string
  seat?: string
  name?: string
  price: number | null
  sold?: boolean
}

export interface Listing {
  id: string
  user_id: string
  title: string
  description: string
  type: ListingType
  status: ListingStatus
  price: number | null
  is_negotiable: boolean
  deal_methods: DealMethod[]
  location: string | null
  team: string | null
  game_date: string | null       // 最早場次日期（由 ticket_items 推算，供排序/篩選用）
  last_game_date: string | null  // 最晚場次日期（供日期範圍重疊篩選用）
  ticket_items: TicketItem[]
  images: string[]
  view_count: number
  removed_reason: string | null
  removed_at: string | null
  created_at: string
  updated_at: string
  profile?: Profile
  comment_count?: number
}

export interface Comment {
  id: string
  listing_id: string
  user_id: string
  parent_id: string | null
  content: string
  created_at: string
  updated_at: string
  profile?: Profile
  replies?: Comment[]
}

export interface Conversation {
  id: string
  listing_id: string | null
  created_at: string
  listing?: Pick<Listing, 'id' | 'title' | 'images'>
  participants?: Profile[]
  last_message?: Message
  unread_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  image_url: string | null
  is_read: boolean
  created_at: string
  sender?: Profile
}

export interface Review {
  id: string
  reviewer_id: string
  reviewee_id: string
  conversation_id: string
  listing_id: string | null
  listing_title: string | null  // 快照，刊登刪除後仍可顯示
  rating: number
  comment: string | null
  created_at: string
  reviewer?: Profile
}

export const CPBL_TEAMS = [
  '中信兄弟',
  '統一7-ELEVEn獅',
  '富邦悍將',
  '樂天桃猿',
  '味全龍',
  '台鋼雄鷹',
  '其他',  // 非中職六隊（明星賽、經典賽、日韓職等）；顏色走 getTeamColor 的 dugout fallback
] as const

export type CpblTeam = typeof CPBL_TEAMS[number]

// 過濾器按鈕的顯示順序（僅影響 tickets / merchandise 頁的隊伍篩選列）
export const TEAM_FILTER_ORDER: CpblTeam[] = [
  '富邦悍將',
  '味全龍',
  '樂天桃猿',
  '中信兄弟',
  '統一7-ELEVEn獅',
  '台鋼雄鷹',
  '其他',
]

// 過濾器按鈕用的兩字簡稱（中信、統一…）；「其他」本身兩字不受影響
export function getTeamShortName(team: string) {
  return team.slice(0, 2)
}

// 球隊代表色對照表（對應 tailwind.config.ts 裡定義的顏色；動態組出的 class 需列在 safelist）
// textOnBg: 球隊色底色上要配的文字顏色（黃色系需要深色文字才有足夠對比度）
export const TEAM_COLORS: Record<string, { bg: string; border: string; textOnBg: string }> = {
  '中信兄弟':       { bg: 'bg-brother',  border: 'border-brother', textOnBg: 'text-black' },
  '統一7-ELEVEn獅': { bg: 'bg-uni',      border: 'border-uni',     textOnBg: 'text-white' },
  '富邦悍將':       { bg: 'bg-fubon',    border: 'border-fubon',   textOnBg: 'text-white' },
  '樂天桃猿':       { bg: 'bg-rakuten',  border: 'border-rakuten', textOnBg: 'text-white' },
  '味全龍':         { bg: 'bg-wei',      border: 'border-wei',     textOnBg: 'text-white' },
  '台鋼雄鷹':       { bg: 'bg-tsg',      border: 'border-tsg',     textOnBg: 'text-white' },
}

export function getTeamColor(team: string | null | undefined) {
  return TEAM_COLORS[team ?? ''] ?? { bg: 'bg-dugout', border: 'border-dugout', textOnBg: 'text-white' }
}

