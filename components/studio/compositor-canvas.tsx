"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import type { BackgroundConfig } from "@/lib/background"
import type { CompositionLayout } from "@/lib/composition-layout"
import {
  compositeImageWithLayout,
  loadForegroundImage,
} from "@/lib/image-compositor"
import { cn } from "@/lib/utils"
import { TransparencyBackground } from "@/components/studio/transparency-background"

interface CompositorPreviewProps {
  foregroundUrl: string
  background?: BackgroundConfig
  layout?: CompositionLayout
  className?: string
}

export function CompositorPreview({
  foregroundUrl,
  background,
  layout,
  className,
}: CompositorPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const backgroundType = background?.type
  const backgroundColor =
    background?.type === "solid" ? background.color : undefined
  const backgroundImageUrl =
    background?.type === "image" ? background.imageUrl : undefined

  useEffect(() => {
    let cancelled = false

    async function render() {
      setLoading(true)
      setError(null)

      try {
        const foreground = await loadForegroundImage(foregroundUrl)
        if (cancelled) return

        let backgroundConfig: BackgroundConfig | undefined
        if (backgroundType === "solid" && backgroundColor) {
          backgroundConfig = { type: "solid", color: backgroundColor }
        } else if (backgroundType === "image" && backgroundImageUrl) {
          backgroundConfig = { type: "image", imageUrl: backgroundImageUrl }
        }

        const canvas = await compositeImageWithLayout(
          foreground,
          backgroundConfig,
          layout
        )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout fields listed individually to avoid object reference churn
  }, [
    foregroundUrl,
    backgroundType,
    backgroundColor,
    backgroundImageUrl,
    layout?.width,
    layout?.height,
    layout?.foreground.x,
    layout?.foreground.y,
    layout?.foreground.width,
    layout?.foreground.height,
    layout?.background?.x,
    layout?.background?.y,
    layout?.background?.width,
    layout?.background?.height,
  ])

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

/** @deprecated Use CompositorPreview */
export const CompositorCanvas = CompositorPreview
