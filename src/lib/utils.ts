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

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

// 純日期字串同樣不能丟給 new Date()（會被當 UTC 午夜），用本地時間建構
export function formatWeekday(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(date)
  return WEEKDAY_LABELS[d.getDay()]
}

export function formatDateWithWeekday(date: string): string {
  // 用半形括號、不留空格，日期與星期顯示更緊湊
  return `${formatDate(date)}(${formatWeekday(date)})`
}

// 從 Supabase Storage 的 public URL 反推出 bucket 內的檔案路徑（供刪除檔案用）
export function storagePathFromUrl(url: string): string | null {
  const marker = '/object/public/images/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  // 去掉查詢字串（頭像 URL 帶 ?t= 快取參數）
  return url.slice(idx + marker.length).split('?')[0]
}

function loadImageElement(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { resolve(img); URL.revokeObjectURL(url) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片載入失敗')) }
    img.src = url
  })
}

// 手機上（尤其較舊 iOS Safari）超高解析度照片（如新款 iPhone 主鏡頭拍出的 4000x5000+）
// 直接 drawImage 到 canvas 常因 GPU 貼圖尺寸上限而靜默失敗，導致上傳一直失敗。
// 超過安全尺寸時改用 createImageBitmap 的 resize 選項在解碼階段就縮小，避開這個限制。
const MAX_SAFE_CANVAS_DIM = 4000

async function loadSafeCanvasSource(file: File | Blob): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  scale: number
}> {
  const img = await loadImageElement(file)
  if (img.naturalWidth <= MAX_SAFE_CANVAS_DIM && img.naturalHeight <= MAX_SAFE_CANVAS_DIM) {
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, scale: 1 }
  }
  const scale = Math.min(MAX_SAFE_CANVAS_DIM / img.naturalWidth, MAX_SAFE_CANVAS_DIM / img.naturalHeight)
  const width = Math.round(img.naturalWidth * scale)
  const height = Math.round(img.naturalHeight * scale)
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation 一定要跟 <img>（一律套用 EXIF 方向）一致，否則直向手機照片
      // raw sensor 是橫的、跟這裡指定的 resize 目標長寬比對不上，createImageBitmap 會噴錯
      const bitmap = await createImageBitmap(file, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: 'high',
        imageOrientation: 'from-image',
      })
      return { source: bitmap, width, height, scale }
    } catch {
      // 不支援就退回原圖硬畫，至少還有機會成功
    }
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, scale: 1 }
}

// react-easy-crop 給的 pixel crop 範圍，依裁切框比例輸出（最長邊 = outputSizePx）
export async function getCroppedImage(
  file: File,
  crop: { x: number; y: number; width: number; height: number },
  outputSizePx = 400,
  quality = 0.85
): Promise<{ blob: Blob; ext: string; contentType: string }> {
  const { source, scale } = await loadSafeCanvasSource(file)
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const cropRatio = crop.width / crop.height
    canvas.width = cropRatio >= 1 ? outputSizePx : Math.round(outputSizePx * cropRatio)
    canvas.height = cropRatio >= 1 ? Math.round(outputSizePx / cropRatio) : outputSizePx
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(
      source,
      crop.x * scale, crop.y * scale, crop.width * scale, crop.height * scale,
      0, 0, canvas.width, canvas.height
    )
    // 部分手機瀏覽器（如較舊版 iOS Safari）canvas 不支援輸出 webp，toBlob 會回傳 null，
    // 這裡失敗時改用 jpeg 再試一次，避免手機上傳直接失敗
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve({ blob, ext: 'webp', contentType: 'image/webp' })
          return
        }
        canvas.toBlob(
          fallbackBlob => fallbackBlob
            ? resolve({ blob: fallbackBlob, ext: 'jpg', contentType: 'image/jpeg' })
            : reject(new Error('裁切失敗')),
          'image/jpeg',
          quality
        )
      },
      'image/webp',
      quality
    )
  })
}

export interface RedactRect {
  x: number
  y: number
  width: number
  height: number
}

// 把使用者畫的黑框（原始像素座標）燒進圖片，回傳遮蔽後的圖片
export async function redactImage(file: File | Blob, rects: RedactRect[]): Promise<Blob> {
  const { source, width, height, scale } = await loadSafeCanvasSource(file)
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(source, 0, 0, width, height)
    ctx.fillStyle = '#000'
    for (const r of rects) {
      ctx.fillRect(r.x * scale, r.y * scale, r.width * scale, r.height * scale)
    }
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('遮蔽失敗')),
      'image/png'
    )
  })
}

export async function compressImage(
  file: File,
  maxWidthPx = 1200,
  quality = 0.8
): Promise<{ blob: Blob; ext: string; contentType: string }> {
  const { source, width, height } = await loadSafeCanvasSource(file)
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ratio = Math.min(maxWidthPx / width, 1)
    canvas.width = width * ratio
    canvas.height = height * ratio
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    // 部分手機瀏覽器（如較舊版 iOS Safari）canvas 不支援輸出 webp，toBlob 會回傳 null，
    // 這裡失敗時改用 jpeg 再試一次，避免手機上傳直接失敗
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve({ blob, ext: 'webp', contentType: 'image/webp' })
          return
        }
        canvas.toBlob(
          fallbackBlob => fallbackBlob
            ? resolve({ blob: fallbackBlob, ext: 'jpg', contentType: 'image/jpeg' })
            : reject(new Error('壓縮失敗')),
          'image/jpeg',
          quality
        )
      },
      'image/webp',
      quality
    )
  })
}
