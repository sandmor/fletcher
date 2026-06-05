"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Stage,
  Layer,
  Rect,
  Image as KonvaImage,
  Transformer,
} from "react-konva"
import type Konva from "konva"
import { useAction } from "convex/react"
import { Loader2 } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import type { BackgroundConfig } from "@/lib/background"
import {
  clampFrameSize,
  createDefaultLayout,
  getDisplayScale,
  getFrameOffset,
  getStageViewportInShapeCoords,
  getViewportDimRects,
  getWorkspaceSize,
  layerToStageCoords,
  MIN_FRAME_SIZE,
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

const FRAME_STROKE = "#3b82f6"

type FrameBounds = LayerRect

const DIM_COLOR = "rgba(0, 0, 0, 0.45)"

function ViewportDimOverlay({
  stageSize,
  workspaceWidth,
  workspaceHeight,
  displayScale,
  frameBounds,
}: {
  stageSize: { width: number; height: number }
  workspaceWidth: number
  workspaceHeight: number
  displayScale: number
  frameBounds: FrameBounds
}) {
  const viewport = getStageViewportInShapeCoords(
    stageSize.width,
    stageSize.height,
    workspaceWidth,
    workspaceHeight,
    displayScale
  )
  const dimRects = getViewportDimRects(viewport, frameBounds)

  return (
    <>
      {dimRects.map((rect, index) => (
        <Rect
          key={index}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill={DIM_COLOR}
          listening={false}
        />
      ))}
    </>
  )
}

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
  const frameTransformRafRef = useRef<number | null>(null)
  const liveFrameRef = useRef<FrameBounds | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [foregroundImage, setForegroundImage] =
    useState<HTMLImageElement | null>(null)
  const [backgroundImage, setBackgroundImage] =
    useState<HTMLImageElement | null>(null)
  const [layout, setLayout] = useState<CompositionLayout | null>(null)
  const [selectedLayer, setSelectedLayer] =
    useState<SelectableLayer>("foreground")
  const [liveFrame, setLiveFrame] = useState<FrameBounds | null>(null)
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [displayScale, setDisplayScale] = useState(1)
  const initialLayoutRef = useRef(initialLayout)

  const persistLayout = useDebouncedCallback(
    (nextLayout: CompositionLayout) => {
      void updateLayout({
        jobId,
        compositionLayout: nextLayout,
      })
    },
    500
  )

  const backgroundIdentityKey =
    background.type === "solid" ? "solid" : `image:${background.imageUrl}`

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

        const defaultLayout = createDefaultLayout(fg, bgImage ?? background)
        const nextLayout = initialLayoutRef.current ?? defaultLayout

        setForegroundImage(fg)
        setBackgroundImage(bgImage)
        setLayout(nextLayout)
        setLiveFrame(null)
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

    const updateStageMetrics = (width: number, height: number) => {
      setStageSize({ width, height })

      const workspace = getWorkspaceSize(layout)
      setDisplayScale(
        getDisplayScale(width, height, workspace.width, workspace.height)
      )
    }

    const { width, height } = container.getBoundingClientRect()
    if (width > 0 && height > 0) {
      updateStageMetrics(width, height)
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width: nextWidth, height: nextHeight } = entry.contentRect
      updateStageMetrics(nextWidth, nextHeight)
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [layout])

  useEffect(() => {
    liveFrameRef.current = liveFrame
  }, [liveFrame])

  useEffect(() => {
    return () => {
      if (frameTransformRafRef.current !== null) {
        cancelAnimationFrame(frameTransformRafRef.current)
      }
    }
  }, [])

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
    setLiveFrame(null)
    setLayout(defaultLayout)
    persistLayout(defaultLayout)
  }, [foregroundImage, backgroundImage, background, persistLayout])

  const handleFrameTransform = useCallback(() => {
    const node = frameRef.current
    if (!node) return

    const baked: FrameBounds = {
      x: node.x(),
      y: node.y(),
      width: Math.max(node.width() * node.scaleX(), MIN_FRAME_SIZE),
      height: Math.max(node.height() * node.scaleY(), MIN_FRAME_SIZE),
    }

    node.scaleX(1)
    node.scaleY(1)
    node.position({ x: baked.x, y: baked.y })
    node.width(baked.width)
    node.height(baked.height)

    if (frameTransformRafRef.current !== null) return

    frameTransformRafRef.current = requestAnimationFrame(() => {
      frameTransformRafRef.current = null
      const current = frameRef.current
      if (!current) return

      setLiveFrame({
        x: current.x(),
        y: current.y(),
        width: current.width(),
        height: current.height(),
      })
    })
  }, [])

  const frameTransformIsActive = useCallback(() => {
    const node = frameRef.current
    if (!node || !layout) return liveFrameRef.current !== null

    const offset = getFrameOffset()
    return (
      liveFrameRef.current !== null ||
      node.scaleX() !== 1 ||
      node.scaleY() !== 1 ||
      node.x() !== offset.x ||
      node.y() !== offset.y ||
      node.width() !== layout.width ||
      node.height() !== layout.height
    )
  }, [layout])

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
          Math.max(node.width() * scaleX, MIN_FRAME_SIZE),
          Math.max(node.height() * scaleY, MIN_FRAME_SIZE)
        )

        node.width(nextSize.width)
        node.height(nextSize.height)

        setLiveFrame(null)
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

  const selectLayer = useCallback(
    (layer: SelectableLayer) => {
      if (selectedLayer === "frame" && layer !== "frame") {
        if (frameTransformIsActive()) {
          handleTransformEnd("frame")
        } else {
          setLiveFrame(null)
        }
      } else {
        setLiveFrame(null)
      }
      setSelectedLayer(layer)
    },
    [selectedLayer, handleTransformEnd, frameTransformIsActive]
  )

  const handleDragEnd = useCallback(
    (layer: "foreground" | "background") => {
      const node =
        layer === "foreground" ? foregroundRef.current : backgroundRef.current

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

  const workspace = getWorkspaceSize(layout)
  const frameOffset = getFrameOffset()
  const frameBounds: FrameBounds = liveFrame ?? {
    x: frameOffset.x,
    y: frameOffset.y,
    width: layout.width,
    height: layout.height,
  }
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
              selectLayer("foreground")
            }
          }}
        >
          <Layer>
            {backgroundStage &&
              background.type === "image" &&
              backgroundImage && (
                <KonvaImage
                  ref={backgroundRef as React.RefObject<Konva.Image>}
                  image={backgroundImage}
                  x={backgroundStage.x}
                  y={backgroundStage.y}
                  width={backgroundStage.width}
                  height={backgroundStage.height}
                  draggable
                  onClick={() => selectLayer("background")}
                  onTap={() => selectLayer("background")}
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
                onClick={() => selectLayer("background")}
                onTap={() => selectLayer("background")}
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
              onClick={() => selectLayer("foreground")}
              onTap={() => selectLayer("foreground")}
              onDragEnd={() => handleDragEnd("foreground")}
              onTransformEnd={() => handleTransformEnd("foreground")}
            />
          </Layer>

          <Layer listening={false}>
            <ViewportDimOverlay
              stageSize={stageSize}
              workspaceWidth={workspace.width}
              workspaceHeight={workspace.height}
              displayScale={displayScale}
              frameBounds={frameBounds}
            />
          </Layer>

          <Layer>
            <Rect
              ref={frameRef}
              x={frameBounds.x}
              y={frameBounds.y}
              width={frameBounds.width}
              height={frameBounds.height}
              stroke={FRAME_STROKE}
              strokeWidth={2}
              dash={[8, 4]}
              fillEnabled={false}
              draggable={false}
              onClick={() => selectLayer("frame")}
              onTap={() => selectLayer("frame")}
              onTransform={handleFrameTransform}
              onTransformEnd={() => handleTransformEnd("frame")}
            />

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              borderEnabled={selectedLayer !== "frame"}
              anchorFill="#3b82f6"
              anchorStroke="#ffffff"
              anchorSize={8}
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
                  : ["top-left", "top-right", "bottom-left", "bottom-right"]
              }
              boundBoxFunc={(oldBox, newBox) => {
                if (
                  selectedLayer === "frame" &&
                  (newBox.width < MIN_FRAME_SIZE ||
                    newBox.height < MIN_FRAME_SIZE)
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
              onClick={() => selectLayer(id)}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleReset()}
          >
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
