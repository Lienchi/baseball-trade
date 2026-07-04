'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { redactImage, getCroppedImage, type RedactRect } from '@/lib/utils'
import { Crop } from 'lucide-react'

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
  const [step, setStep] = useState<'crop' | 'mark'>('crop')

  // 裁切步驟（選填，預設不裁切，只有勾選方形裁切才會強制 1:1）
  const [cropUrl, setCropUrl] = useState<string | null>(null)
  const [squareCrop, setSquareCrop] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [applyingCrop, setApplyingCrop] = useState(false)

  // 遮蔽步驟：對裁切後（或原始）的檔案畫黑框
  const [workingFile, setWorkingFile] = useState<File>(file)
  const [markUrl, setMarkUrl] = useState<string | null>(null)
  const [rects, setRects] = useState<DisplayRect[]>([])
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<DisplayRect | null>(null)
  const [processing, setProcessing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setStep('crop')
    setSquareCrop(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setWorkingFile(file)
    setRects([])
  }, [file])

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setCropUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (step !== 'mark') return
    const url = URL.createObjectURL(workingFile)
    setMarkUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [workingFile, step])

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const goToMark = async () => {
    if (!squareCrop || !croppedAreaPixels) {
      setWorkingFile(file)
      setStep('mark')
      return
    }
    setApplyingCrop(true)
    try {
      const blob = await getCroppedImage(file, croppedAreaPixels, 1000, 0.9)
      setWorkingFile(new File([blob], `cropped-${Date.now()}.webp`, { type: 'image/webp' }))
    } catch {
      setWorkingFile(file)
    } finally {
      setApplyingCrop(false)
      setStep('mark')
    }
  }

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
      const blob = rects.length > 0 ? await redactImage(workingFile, natRects) : workingFile
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
        {step === 'crop' ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-dugout">確認照片，需要裁成正方形嗎？</p>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                  squareCrop
                    ? 'border-field bg-field/10 text-field'
                    : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
                }`}
                onClick={() => setSquareCrop(v => !v)}
              >
                <Crop size={12} /> 方形裁切
              </button>
            </div>

            {squareCrop ? (
              <>
                <div className="relative h-72 w-full overflow-hidden rounded-lg bg-scoreboard/5">
                  {cropUrl && (
                    <Cropper
                      image={cropUrl}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      showGrid={false}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  )}
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  className="mt-4 w-full"
                />
              </>
            ) : (
              cropUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cropUrl} alt="" className="max-h-[60vh] w-full rounded-md object-contain" />
              )
            )}

            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={applyingCrop}>
                取消
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={goToMark}
                disabled={applyingCrop || (squareCrop && !croppedAreaPixels)}
              >
                {applyingCrop ? '處理中...' : '下一步'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-dugout">拖曳畫出黑框，遮住姓名、電話、Email 等個人資訊</p>

            <div
              ref={containerRef}
              className="relative max-h-[60vh] touch-none select-none overflow-y-auto rounded-md bg-scoreboard/5"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {markUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img ref={imgRef} src={markUrl} alt="" className="w-full select-none" draggable={false} />
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
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep('crop')} disabled={processing}>
                上一步
              </button>
              <button type="button" className="btn-primary flex-1" onClick={handleConfirm} disabled={processing}>
                {processing ? '處理中...' : '完成套用'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
