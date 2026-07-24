import type { MetadataRoute } from 'next'
import { createStaticClient } from '@/lib/supabase/static'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://benjifan.com').replace(/\/+$/, '')

// 爬蟲高頻打 sitemap，用匿名 client 保持靜態、一天重算一次即可
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createStaticClient()
  const { data: listings } = await supabase
    .from('listings')
    .select('id, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1000)

  const staticPages: MetadataRoute.Sitemap = [
    // 首頁即球票列表；周邊為獨立頁；/tickets 只做轉址故不列
    { url: SITE_URL, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/merchandise`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/deal-stars`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'monthly', priority: 0.2 },
  ]

  const listingPages: MetadataRoute.Sitemap = (listings ?? []).map(l => ({
    url: `${SITE_URL}/listings/${l.id}`,
    lastModified: l.updated_at,
    changeFrequency: 'daily',
    priority: 0.7,
  }))

  return [...staticPages, ...listingPages]
}
