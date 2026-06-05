"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import type { BackgroundConfig } from "@/lib/background"
import {
  compositeImage,
  loadForegroundImage,
} from "@/lib/image-compositor"
import { cn } from "@/lib/utils"
import { TransparencyBackground } from "@/components/studio/transparency-background"

interface CompositorCanvasProps {
  foregroundUrl: string
  background?: BackgroundConfig
  className?: string
}

export function CompositorCanvas({
  foregroundUrl,
  background,
  className,
}: CompositorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      setLoading(true)
      setError(null)

      try {
        const foreground = await loadForegroundImage(foregroundUrl)
        if (cancelled) return

        const canvas = await compositeImage(foreground, background)
        const displayCanvas = canvasRef.current
        if (!displayCanvas) return

        displayCanvas.width = canvas.width
        displayCanvas.height = canvas.height

        const context = displayCanvas.getContext("2d")
        if (!context) {
          throw new Error("Canvas 2D context is unavailable")
        }

        context.clearRect(0, 0, displayCanvas.width, displayCanvas.height)
        context.drawImage(canvas, 0, 0)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to render preview"
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void render()

    return () => {
      cancelled = true
    }
  }, [foregroundUrl, background])

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center",
        className
      )}
    >
      {!background && <TransparencyBackground />}

      <canvas
        ref={canvasRef}
        className="relative z-10 max-h-full max-w-full object-contain drop-shadow-2xl"
      />

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 px-6 text-center text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
