'use client'

import { useEffect, useRef, useState } from 'react'
import { redactImage, type RedactRect } from '@/lib/utils'

interface DisplayRect { x: number; y: number; width: number; height: number }

export function RedactModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [rects, setRects] = useState<DisplayRect[]>([])
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<DisplayRect | null>(null)
  const [processing, setProcessing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const toLocalPoint = (e: React.PointerEvent) => {
    const box = containerRef.current!.getBoundingClientRect()
    return {
      x: Math.min(Math.max(e.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(e.clientY - box.top, 0), box.height),
    }
  }

  const normalize = (a: { x: number; y: number }, b: { x: number; y: number }): DisplayRect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  })

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const p = toLocalPoint(e)
    setDrawStart(p)
    setCurrentRect({ x: p.x, y: p.y, width: 0, height: 0 })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawStart) return
    e.preventDefault()
    setCurrentRect(normalize(drawStart, toLocalPoint(e)))
  }

  const handlePointerUp = () => {
    if (currentRect && currentRect.width > 4 && currentRect.height > 4) {
      setRects(prev => [...prev, currentRect])
    }
    setDrawStart(null)
    setCurrentRect(null)
  }

  const handleConfirm = async () => {
    if (!imgRef.current) return
    setProcessing(true)
    try {
      const scale = imgRef.current.naturalWidth / imgRef.current.clientWidth
      const natRects: RedactRect[] = rects.map(r => ({
        x: r.x * scale,
        y: r.y * scale,
        width: r.width * scale,
        height: r.height * scale,
      }))
      const blob = await redactImage(file, natRects)
      onConfirm(blob)
    } catch {
      onCancel()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scoreboard/60 px-4">
      <div className="card w-full max-w-md p-5">
        <p className="mb-2 text-sm text-dugout">拖曳畫出黑框，遮住姓名、電話、Email 等個人資訊</p>

        <div
          ref={containerRef}
          className="relative max-h-[60vh] touch-none select-none overflow-y-auto rounded-md bg-scoreboard/5"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {imgUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={imgRef} src={imgUrl} alt="" className="w-full select-none" draggable={false} />
          )}
          {rects.map((r, i) => (
            <div
              key={i}
              className="absolute bg-black"
              style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
            />
          ))}
          {currentRect && (
            <div
              className="absolute bg-black/70"
              style={{ left: currentRect.x, top: currentRect.y, width: currentRect.width, height: currentRect.height }}
            />
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="text-xs font-bold text-dugout hover:text-clay disabled:opacity-30"
            onClick={() => setRects(prev => prev.slice(0, -1))}
            disabled={rects.length === 0}
          >
            復原
          </button>
          <button
            type="button"
            className="text-xs font-bold text-dugout hover:text-clay disabled:opacity-30"
            onClick={() => setRects([])}
            disabled={rects.length === 0}
          >
            清除全部
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={processing}>
            取消
          </button>
          <button type="button" className="btn-primary flex-1" onClick={handleConfirm} disabled={processing}>
            {processing ? '處理中...' : '完成套用'}
          </button>
        </div>
      </div>
    </div>
  )
}
