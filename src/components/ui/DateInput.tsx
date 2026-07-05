'use client'

import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onValueChange: (value: string) => void
  className?: string
  required?: boolean
}

// iOS Safari 日期選擇器的「重置」只發原生 change 事件（React onChange 監聽的是 input 事件），
// 需用原生監聽器才接得到，否則按重置後 state 不會清空
export function DateInput({ value, onValueChange, className, required }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const callbackRef = useRef(onValueChange)
  callbackRef.current = onValueChange

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => callbackRef.current(el.value)
    el.addEventListener('change', handler)
    return () => el.removeEventListener('change', handler)
  }, [])

  return (
    <input
      ref={ref}
      type="date"
      className={className}
      value={value}
      required={required}
      onChange={e => onValueChange(e.target.value)}
    />
  )
}
