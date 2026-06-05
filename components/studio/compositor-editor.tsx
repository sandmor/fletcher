"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from "react-konva"
import type Konva from "konva"
import { useAction } from "convex/react"
import { Loader2 } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import type { BackgroundConfig } from "@/lib/background"
import {
  clampFrameSize,
  createDefaultLayout,
  getFrameOffset,
  getWorkspaceSize,
  layerToStageCoords,
  stageToLayerCoords,
  type CompositionLayout,
  type LayerRect,
} from "@/lib/composition-layout"
import {
  loadBackgroundImage,
  loadForegroundImage,
} from "@/lib/image-compositor"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SelectableLayer = "foreground" | "background" | "frame"

interface CompositorEditorProps {
  jobId: Id<"jobs">
  foregroundUrl: string
  background: BackgroundConfig
  initialLayout?: CompositionLayout
  onDone: () => void
  className?: string
}

function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay]
  )
}

function DimOverlay({
  workspaceWidth,
  workspaceHeight,
  frameX,
  frameY,
  frameWidth,
  frameHeight,
}: {
  workspaceWidth: number
  workspaceHeight: number
  frameX: number
  frameY: number
  frameWidth: number
  frameHeight: number
}) {
  const dimColor = "rgba(0, 0, 0, 0.45)"

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={workspaceWidth}
        height={frameY}
        fill={dimColor}
        listening={false}
      />
      <Rect
        x={0}
        y={frameY + frameHeight}
        width={workspaceWidth}
        height={workspaceHeight - frameY - frameHeight}
        fill={dimColor}
        listening={false}
      />
      <Rect
        x={0}
        y={frameY}
        width={frameX}
        height={frameHeight}
        fill={dimColor}
        listening={false}
      />
      <Rect
        x={frameX + frameWidth}
        y={frameY}
        width={workspaceWidth - frameX - frameWidth}
        height={frameHeight}
        fill={dimColor}
        listening={false}
      />
    </>
  )
}

export function CompositorEditor({
  jobId,
  foregroundUrl,
  background,
  initialLayout,
  onDone,
  className,
}: CompositorEditorProps) {
  const updateLayout = useAction(api.jobs.updateJobCompositionLayout)
  const containerRef = useRef<HTMLDivElement>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const foregroundRef = useRef<Konva.Image>(null)
  const backgroundRef = useRef<Konva.Image | Konva.Rect>(null)
  const frameRef = useRef<Konva.Rect>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [foregroundImage, setForegroundImage] =
    useState<HTMLImageElement | null>(null)
  const [backgroundImage, setBackgroundImage] =
    useState<HTMLImageElement | null>(null)
  const [layout, setLayout] = useState<CompositionLayout | null>(null)
  const [selectedLayer, setSelectedLayer] = useState<SelectableLayer>("foreground")
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [displayScale, setDisplayScale] = useState(1)
  const initialLayoutRef = useRef(initialLayout)

  const persistLayout = useDebouncedCallback((nextLayout: CompositionLayout) => {
    void updateLayout({
      jobId,
      compositionLayout: nextLayout,
    })
  }, 500)

  const backgroundIdentityKey =
    background.type === "solid"
      ? "solid"
      : `image:${background.imageUrl}`

  useEffect(() => {
    let cancelled = false

    async function loadAssets() {
      setLoading(true)
      setError(null)

      try {
        const fg = await loadForegroundImage(foregroundUrl)
        if (cancelled) return

        let bgImage: HTMLImageElement | null = null
        if (background.type === "image") {
          bgImage = await loadBackgroundImage(background.imageUrl)
          if (cancelled) return
        }

        const defaultLayout = createDefaultLayout(
          fg,
          bgImage ?? background
        )
        const nextLayout = initialLayoutRef.current ?? defaultLayout

        setForegroundImage(fg)
        setBackgroundImage(bgImage)
        setLayout(nextLayout)
        initialLayoutRef.current = undefined
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load editor assets"
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAssets()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on identity change only; solid color updates via render
  }, [foregroundUrl, backgroundIdentityKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !layout) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setStageSize({ width, height })

      const workspace = getWorkspaceSize(layout)
      const scale = Math.min(
        width / workspace.width,
        height / workspace.height,
        1
      )
      setDisplayScale(scale)
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [layout])

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return

    const node =
      selectedLayer === "foreground"
        ? foregroundRef.current
        : selectedLayer === "background"
          ? backgroundRef.current
          : frameRef.current

    if (node) {
      transformer.nodes([node])
      transformer.getLayer()?.batchDraw()
    }
  }, [selectedLayer, layout, foregroundImage, backgroundImage])

  const updateLayoutState = useCallback(
    (updater: (current: CompositionLayout) => CompositionLayout) => {
      setLayout((current) => {
        if (!current) return current
        const next = updater(current)
        persistLayout(next)
        return next
      })
    },
    [persistLayout]
  )

  const handleReset = useCallback(async () => {
    if (!foregroundImage) return

    const defaultLayout = createDefaultLayout(
      foregroundImage,
      backgroundImage ?? background
    )
    setLayout(defaultLayout)
    persistLayout(defaultLayout)
  }, [foregroundImage, backgroundImage, background, persistLayout])

  const handleTransformEnd = useCallback(
    (layer: SelectableLayer) => {
      const node =
        layer === "foreground"
          ? foregroundRef.current
          : layer === "background"
            ? backgroundRef.current
            : frameRef.current

      if (!node || !layout) return

      const scaleX = node.scaleX()
      const scaleY = node.scaleY()

      node.scaleX(1)
      node.scaleY(1)

      if (layer === "frame") {
        const offset = getFrameOffset()
        node.x(offset.x)
        node.y(offset.y)

        const nextSize = clampFrameSize(
          Math.max(node.width() * scaleX, MIN_FRAME_FROM_NODE),
          Math.max(node.height() * scaleY, MIN_FRAME_FROM_NODE)
        )

        node.width(nextSize.width)
        node.height(nextSize.height)

        updateLayoutState((current) => ({
          ...current,
          width: nextSize.width,
          height: nextSize.height,
        }))
        return
      }

      const stageRect: LayerRect = {
        x: node.x(),
        y: node.y(),
        width: Math.max(node.width() * scaleX, 1),
        height: Math.max(node.height() * scaleY, 1),
      }

      node.width(stageRect.width)
      node.height(stageRect.height)

      const layerKey = layer === "foreground" ? "foreground" : "background"
      const layerCoords = stageToLayerCoords(stageRect)

      updateLayoutState((current) => ({
        ...current,
        [layerKey]: layerCoords,
      }))
    },
    [layout, updateLayoutState]
  )

  const handleDragEnd = useCallback(
    (layer: "foreground" | "background") => {
      const node =
        layer === "foreground"
          ? foregroundRef.current
          : backgroundRef.current

      if (!node || !layout) return

      const stageRect: LayerRect = {
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
      }

      const layerKey = layer === "foreground" ? "foreground" : "background"
      const layerCoords = stageToLayerCoords(stageRect)

      updateLayoutState((current) => ({
        ...current,
        [layerKey]: layerCoords,
      }))
    },
    [layout, updateLayoutState]
  )

  if (loading || !layout || !foregroundImage) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center",
          className
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center px-6 text-center text-sm text-destructive",
          className
        )}
      >
        {error}
      </div>
    )
  }

  const workspace = getWorkspaceSize(layout)
  const frameOffset = getFrameOffset()
  const foregroundStage = layerToStageCoords(layout.foreground)
  const backgroundStage = layout.background
    ? layerToStageCoords(layout.background)
    : null

  return (
    <div className={cn("flex h-full w-full flex-col gap-3", className)}>
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-muted/20"
      >
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          scaleX={displayScale}
          scaleY={displayScale}
          x={(stageSize.width - workspace.width * displayScale) / 2}
          y={(stageSize.height - workspace.height * displayScale) / 2}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) {
              setSelectedLayer("foreground")
            }
          }}
        >
          <Layer>
            <DimOverlay
              workspaceWidth={workspace.width}
              workspaceHeight={workspace.height}
              frameX={frameOffset.x}
              frameY={frameOffset.y}
              frameWidth={layout.width}
              frameHeight={layout.height}
            />

            {backgroundStage && background.type === "image" && backgroundImage && (
              <KonvaImage
                ref={backgroundRef as React.RefObject<Konva.Image>}
                image={backgroundImage}
                x={backgroundStage.x}
                y={backgroundStage.y}
                width={backgroundStage.width}
                height={backgroundStage.height}
                draggable
                onClick={() => setSelectedLayer("background")}
                onTap={() => setSelectedLayer("background")}
                onDragEnd={() => handleDragEnd("background")}
                onTransformEnd={() => handleTransformEnd("background")}
              />
            )}

            {backgroundStage && background.type === "solid" && (
              <Rect
                ref={backgroundRef as React.RefObject<Konva.Rect>}
                x={backgroundStage.x}
                y={backgroundStage.y}
                width={backgroundStage.width}
                height={backgroundStage.height}
                fill={background.color}
                draggable
                onClick={() => setSelectedLayer("background")}
                onTap={() => setSelectedLayer("background")}
                onDragEnd={() => handleDragEnd("background")}
                onTransformEnd={() => handleTransformEnd("background")}
              />
            )}

            <KonvaImage
              ref={foregroundRef}
              image={foregroundImage}
              x={foregroundStage.x}
              y={foregroundStage.y}
              width={foregroundStage.width}
              height={foregroundStage.height}
              draggable
              onClick={() => setSelectedLayer("foreground")}
              onTap={() => setSelectedLayer("foreground")}
              onDragEnd={() => handleDragEnd("foreground")}
              onTransformEnd={() => handleTransformEnd("foreground")}
            />

            <Rect
              ref={frameRef}
              x={frameOffset.x}
              y={frameOffset.y}
              width={layout.width}
              height={layout.height}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[8, 4]}
              fill="transparent"
              draggable={false}
              onClick={() => setSelectedLayer("frame")}
              onTap={() => setSelectedLayer("frame")}
              onTransformEnd={() => handleTransformEnd("frame")}
            />

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              enabledAnchors={
                selectedLayer === "frame"
                  ? [
                      "top-left",
                      "top-right",
                      "bottom-left",
                      "bottom-right",
                      "middle-left",
                      "middle-right",
                      "top-center",
                      "bottom-center",
                    ]
                  : [
                      "top-left",
                      "top-right",
                      "bottom-left",
                      "bottom-right",
                    ]
              }
              boundBoxFunc={(oldBox, newBox) => {
                if (
                  newBox.width < MIN_FRAME_FROM_NODE ||
                  newBox.height < MIN_FRAME_FROM_NODE
                ) {
                  return oldBox
                }
                return newBox
              }}
            />
          </Layer>
        </Stage>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["foreground", "Foreground"],
              ["background", "Background"],
              ["frame", "Frame"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedLayer(id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedLayer === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleReset()}>
            Reset to default
          </Button>
          <Button type="button" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Drag layers to reposition. Content outside the frame will not appear in
        the final image.
      </p>
    </div>
  )
}

const MIN_FRAME_FROM_NODE = 32
