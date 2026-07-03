export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  rating: number
  rating_count: number
  created_at: string
}

export type ListingType = 'ticket' | 'merchandise'
export type ListingStatus = 'active' | 'sold' | 'closed'
export type DealMethod = 'meetup' | 'mail' | 'eticket' | 'app_transfer'

export const DEAL_METHOD_LABELS: Record<DealMethod, string> = {
  meetup: '面交',
  mail: '郵寄',
  eticket: '電子票券',
  app_transfer: 'APP轉票',
}

// 各刊登類型可選的交易方式（電子票券/APP轉票 僅適用於球票）
export const DEAL_METHOD_OPTIONS: Record<ListingType, DealMethod[]> = {
  ticket: ['meetup', 'mail', 'eticket', 'app_transfer'],
  merchandise: ['meetup', 'mail'],
}

// 球票場次：一篇刊登可包含多筆「日期 + 座位資訊 + 票價」
export interface TicketItem {
  date: string
  seat: string
  price: number | null
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
  game_date: string | null  // 最早場次日期（由 ticket_items 推算，供排序/篩選用）
  ticket_items: TicketItem[]
  images: string[]
  view_count: number
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
  listing_id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer?: Profile
}

export interface ListingFilters {
  type?: ListingType
  team?: string
  minPrice?: number
  maxPrice?: number
  dealMethod?: DealMethod
  status?: ListingStatus
  query?: string
}

export const CPBL_TEAMS = [
  '中信兄弟',
  '統一7-ELEVEn獅',
  '富邦悍將',
  '樂天桃猿',
  '味全龍',
  '台鋼雄鷹',
] as const

export type CpblTeam = typeof CPBL_TEAMS[number]

// 球隊代表色對照表（對應 tailwind.config.ts 裡定義的顏色）
// textOnBg: 球隊色底色上要配的文字顏色（黃色系需要深色文字才有足夠對比度）
export const TEAM_COLORS: Record<string, { bg: string; text: string; border: string; textOnBg: string }> = {
  '中信兄弟':       { bg: 'bg-brother',  text: 'text-brother',  border: 'border-brother', textOnBg: 'text-black' },
  '統一7-ELEVEn獅': { bg: 'bg-uni',      text: 'text-uni',      border: 'border-uni',     textOnBg: 'text-white' },
  '富邦悍將':       { bg: 'bg-fubon',    text: 'text-fubon',    border: 'border-fubon',   textOnBg: 'text-white' },
  '樂天桃猿':       { bg: 'bg-rakuten',  text: 'text-rakuten',  border: 'border-rakuten', textOnBg: 'text-white' },
  '味全龍':         { bg: 'bg-wei',      text: 'text-wei',      border: 'border-wei',     textOnBg: 'text-white' },
  '台鋼雄鷹':       { bg: 'bg-tsg',      text: 'text-tsg',      border: 'border-tsg',     textOnBg: 'text-white' },
}

export function getTeamColor(team: string | null | undefined) {
  return TEAM_COLORS[team ?? ''] ?? { bg: 'bg-dugout', text: 'text-dugout', border: 'border-dugout', textOnBg: 'text-white' }
}

