import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return `NT$ ${price.toLocaleString('zh-TW')}`
}

export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: zhTW,
  })
}

export function formatDate(date: string): string {
  // 純日期字串（YYYY-MM-DD）不能丟給 new Date()：會被當成 UTC 午夜，
  // 在 UTC 以西的時區顯示會少一天，直接字串重組即可
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (dateOnly) return `${dateOnly[1]}/${dateOnly[2]}/${dateOnly[3]}`
  return format(new Date(date), 'yyyy/MM/dd', { locale: zhTW })
}

// 從 Supabase Storage 的 public URL 反推出 bucket 內的檔案路徑（供刪除檔案用）
export function storagePathFromUrl(url: string): string | null {
  const marker = '/object/public/images/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  // 去掉查詢字串（頭像 URL 帶 ?t= 快取參數）
  return url.slice(idx + marker.length).split('?')[0]
}

export async function compressImage(
  file: File,
  maxWidthPx = 1200,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio = Math.min(maxWidthPx / img.width, 1)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('壓縮失敗')),
        'image/webp',
        quality
      )
      URL.revokeObjectURL(url)
    }
    img.onerror = reject
    img.src = url
  })
}
