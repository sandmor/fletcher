"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { AppIcon } from "@/components/app-icon"
import { Button } from "@/components/ui/button"
import { CompositorEditor } from "@/components/studio/compositor-editor"
import type { BackgroundConfig } from "@/lib/background"
import type { CompositionLayout } from "@/lib/composition-layout"
import { cn } from "@/lib/utils"

interface CompositionEditorOverlayProps {
  open: boolean
  onClose: () => void
  /** Called after the exit animation completes and the overlay unmounts. */
  onClosed?: () => void
  /** Stable per-session identity; captured when the overlay opens. */
  editorKey: string
  /** Bumped by the parent when the server clears layout during an open session. */
  layoutResetToken?: number
  fileName: string
  foregroundUrl: string
  background: BackgroundConfig
  initialLayout?: CompositionLayout
  onDone: (layout: CompositionLayout) => Promise<void>
  saving?: boolean
  backgroundPanel?: ReactNode
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

export function CompositionEditorOverlay({
  open,
  onClose,
  onClosed,
  editorKey,
  layoutResetToken = 0,
  fileName,
  foregroundUrl,
  background,
  initialLayout,
  onDone,
  saving = false,
  backgroundPanel,
}: CompositionEditorOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onClosedRef = useRef(onClosed)
  const [isClosing, setIsClosing] = useState(false)
  const [wasMounted, setWasMounted] = useState(open)
  const [frozenEditorKey, setFrozenEditorKey] = useState(editorKey)

  useEffect(() => {
    onClosedRef.current = onClosed
  }, [onClosed])

  if (open && !wasMounted) {
    setWasMounted(true)
    setFrozenEditorKey(editorKey)
    if (isClosing) setIsClosing(false)
  } else if (!open && wasMounted && !isClosing) {
    setIsClosing(true)
  }

  const shouldRender = wasMounted && (open || isClosing)

  // Remount the in-session editor when the server clears layout (e.g. new bg image).
  useEffect(() => {
    if (!shouldRender || isClosing || layoutResetToken === 0) return
    setFrozenEditorKey(`${editorKey}-layout-reset-${layoutResetToken}`)
  }, [editorKey, isClosing, layoutResetToken, shouldRender])

  // Lock body scroll, trap focus, and wire Escape-to-cancel while the overlay is mounted.
  useEffect(() => {
    if (!shouldRender) return

    const previousActive = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    if (!isClosing) {
      closeRef.current?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== "Tab") return
      const panel = panelRef.current
      if (!panel) return

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActive?.focus?.()
    }
  }, [shouldRender, isClosing, onClose])

  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (isClosing) {
      setIsClosing(false)
      setWasMounted(false)
      onClosedRef.current?.()
    }
  }

  if (!shouldRender) return null

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit composition — ${fileName}`}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background",
        isClosing ? "animate-editor-out" : "animate-editor-in"
      )}
      onAnimationEnd={handleAnimationEnd}
    >
      <header className="flex h-(--editor-toolbar-h) shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary">
            <AppIcon size={15} className="text-primary-foreground" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Composition
            </span>
            <span className="truncate text-sm font-medium" title={fileName}>
              {fileName}
            </span>
          </div>
        </div>
        <Button
          ref={closeRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close editor without saving"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>

      <div className="min-h-0 flex-1">
        <CompositorEditor
          key={frozenEditorKey}
          foregroundUrl={foregroundUrl}
          background={background}
          initialLayout={initialLayout}
          onDone={onDone}
          saving={saving}
          backgroundPanel={backgroundPanel}
          className="h-full w-full"
        />
      </div>
    </div>,
    document.body
  )
}
