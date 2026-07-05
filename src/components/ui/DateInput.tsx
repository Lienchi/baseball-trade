'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onValueChange: (value: string) => void
  className?: string
  required?: boolean
}

// iOS Safari 日期選擇器的「重置」只發原生 change 事件（React onChange 監聽的是 input 事件），
// 需用原生監聽器才接得到。另外顯示值由內部 state 管理：外部 value 往往經過 router.push 等
// 非同步流程才更新，若直接受控會在更新前被舊 prop 重設、把剛選的日期清掉
export function DateInput({ value, onValueChange, className, required }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [inner, setInner] = useState(value)
  const lastEmitted = useRef(value)
  const callbackRef = useRef(onValueChange)
  callbackRef.current = onValueChange

  const emit = (v: string) => {
    lastEmitted.current = v
    setInner(v)
    callbackRef.current(v)
  }
  const emitRef = useRef(emit)
  emitRef.current = emit

  // 外部值變動（且不是自己剛送出的值）才同步，避免非同步更新途中的舊值蓋掉選取結果
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setInner(value)
    }
  }, [value])

  // iOS 的重置鈕清空值時不發任何事件（WebKit bug），只能在選擇器開啟（focus）期間
  // 輪詢 DOM 值，偵測到變化就同步；同時保留原生 change 監聽當一般路徑
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => {
      if (el.value !== lastEmitted.current) emitRef.current(el.value)
    }
    let timer: ReturnType<typeof setInterval> | undefined
    const start = () => {
      if (!timer) timer = setInterval(sync, 200)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = undefined }
      sync()
    }
    el.addEventListener('change', sync)
    el.addEventListener('focus', start)
    el.addEventListener('blur', stop)
    return () => {
      if (timer) clearInterval(timer)
      el.removeEventListener('change', sync)
      el.removeEventListener('focus', start)
      el.removeEventListener('blur', stop)
    }
  }, [])

  return (
    <input
      ref={ref}
      type="date"
      className={className}
      value={inner}
      required={required}
      onChange={e => emit(e.target.value)}
    />
  )
}
