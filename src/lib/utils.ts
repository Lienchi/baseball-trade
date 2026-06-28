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
  return format(new Date(date), 'yyyy/MM/dd', { locale: zhTW })
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
