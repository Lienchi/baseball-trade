import { AtSign, Instagram } from 'lucide-react'
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/utils'
import type { SocialLinks } from '@/types'

const PLATFORM_ICONS: Record<SocialPlatform, React.ReactNode> = {
  threads: <AtSign size={13} />,
  instagram: <Instagram size={13} />,
}

// 社群帳號連結列：沒填任何平台時不佔空間
export function SocialLinkRow({ socialLinks }: { socialLinks: SocialLinks | null | undefined }) {
  const entries = (Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[])
    .filter(p => socialLinks?.[p])
  if (entries.length === 0) return null

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {entries.map(platform => (
        <a
          key={platform}
          href={SOCIAL_PLATFORMS[platform].url(socialLinks![platform]!)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-field hover:underline dark:text-blue-400"
        >
          {PLATFORM_ICONS[platform]}
          {SOCIAL_PLATFORMS[platform].label}：@{socialLinks![platform]}
        </a>
      ))}
    </p>
  )
}
