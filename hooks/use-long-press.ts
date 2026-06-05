"use client"

import { useCallback, useRef } from "react"

interface UseLongPressOptions {
  onLongPress: () => void
  delay?: number
  disabled?: boolean
}

export function useLongPress({
  onLongPress,
  delay = 500,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)
  const isTouchRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || e.pointerType !== "touch") return
      isTouchRef.current = true
      didLongPressRef.current = false
      clearTimer()
      timerRef.current = setTimeout(() => {
        didLongPressRef.current = true
        navigator.vibrate?.(10)
        onLongPress()
      }, delay)
    },
    [disabled, delay, onLongPress, clearTimer]
  )

  const onPointerUp = useCallback(() => {
    clearTimer()
    isTouchRef.current = false
  }, [clearTimer])

  const onPointerLeave = useCallback(() => {
    clearTimer()
  }, [clearTimer])

  const onPointerCancel = useCallback(() => {
    clearTimer()
    isTouchRef.current = false
  }, [clearTimer])

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (isTouchRef.current || didLongPressRef.current) {
      e.preventDefault()
    }
  }, [])

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (didLongPressRef.current) {
      e.preventDefault()
      e.stopPropagation()
      didLongPressRef.current = false
    }
  }, [])

  return {
    longPressHandlers: {
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      onContextMenu,
      onClickCapture,
    },
  }
}
