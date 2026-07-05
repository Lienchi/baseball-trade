import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://benjifan.com').replace(/\/+$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient()
  const { data: listings } = await supabase
    .from('listings')
    .select('id, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1000)

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/tickets`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/merchandise`, changeFrequency: 'hourly', priority: 0.9 },
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
