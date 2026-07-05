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

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => {
      if (el.value !== lastEmitted.current) emitRef.current(el.value)
    }
    el.addEventListener('change', handler)
    return () => el.removeEventListener('change', handler)
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
