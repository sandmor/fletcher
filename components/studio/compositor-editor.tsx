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
  clampUserZoom,
  createDefaultLayout,
  getDisplayScale,
  getEffectiveStageTransform,
  getFitCenterOffset,
  getFrameOffset,
  getStageViewportInShapeCoords,
  getViewportDimRects,
  getWorkspaceSize,
  layerToStageCoords,
  MAX_USER_ZOOM,
  MIN_FRAME_SIZE,
  MIN_USER_ZOOM,
  stageToLayerCoords,
  zoomAtPointer,
  type CompositionLayout,
  type LayerRect,
  type Point,
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
  stageX,
  stageY,
  scale,
  frameBounds,
}: {
  stageSize: { width: number; height: number }
  stageX: number
  stageY: number
  scale: number
  frameBounds: FrameBounds
}) {
  const viewport = getStageViewportInShapeCoords(
    stageSize.width,
    stageSize.height,
    stageX,
    stageY,
    scale
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
  const isSpacePressedRef = useRef(false)
  const isPanningRef = useRef(false)
  const lastPanPointerRef = useRef<Point | null>(null)

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
  const [fitScale, setFitScale] = useState(1)
  const [userZoom, setUserZoom] = useState(1)
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
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
      setFitScale(
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

  useEffect(() => {
    isSpacePressedRef.current = isSpacePressed
  }, [isSpacePressed])

  useEffect(() => {
    isPanningRef.current = isPanning
  }, [isPanning])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !layout) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()

      const rect = container.getBoundingClientRect()
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      const workspace = getWorkspaceSize(layout)
      const center = getFitCenterOffset(
        stageSize.width,
        stageSize.height,
        workspace.width,
        workspace.height,
        fitScale
      )
      const scaleFactor = Math.exp(-event.deltaY * 0.002)
      const oldScale = fitScale * userZoom
      const oldPosition = {
        x: center.x + panOffset.x,
        y: center.y + panOffset.y,
      }
      const { scale, position } = zoomAtPointer(
        oldScale,
        oldPosition,
        pointer,
        scaleFactor,
        fitScale * MIN_USER_ZOOM,
        fitScale * MAX_USER_ZOOM
      )

      setUserZoom(clampUserZoom(scale / fitScale))
      setPanOffset({
        x: position.x - center.x,
        y: position.y - center.y,
      })
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [layout, fitScale, userZoom, panOffset, stageSize])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      setIsSpacePressed(true)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return
      setIsSpacePressed(false)
      if (isPanningRef.current) {
        isPanningRef.current = false
        setIsPanning(false)
        lastPanPointerRef.current = null
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const endPan = () => {
      if (!isPanningRef.current) return
      isPanningRef.current = false
      setIsPanning(false)
      lastPanPointerRef.current = null
    }

    const handleMouseDown = (event: MouseEvent) => {
      const spacePan = isSpacePressedRef.current && event.button === 0
      const middlePan = event.button === 1
      if (!spacePan && !middlePan) return

      event.preventDefault()
      isPanningRef.current = true
      setIsPanning(true)
      lastPanPointerRef.current = { x: event.clientX, y: event.clientY }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isPanningRef.current || !lastPanPointerRef.current) return

      event.preventDefault()
      const deltaX = event.clientX - lastPanPointerRef.current.x
      const deltaY = event.clientY - lastPanPointerRef.current.y
      lastPanPointerRef.current = { x: event.clientX, y: event.clientY }

      setPanOffset((current) => ({
        x: current.x + deltaX,
        y: current.y + deltaY,
      }))
    }

    container.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", endPan)
    return () => {
      container.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", endPan)
    }
  }, [])

  const resetView = useCallback(() => {
    setUserZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }, [])

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
    resetView()
    persistLayout(defaultLayout)
  }, [foregroundImage, backgroundImage, background, persistLayout, resetView])

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
  const stageTransform = getEffectiveStageTransform(
    stageSize.width,
    stageSize.height,
    workspace.width,
    workspace.height,
    fitScale,
    userZoom,
    panOffset
  )
  const layersDraggable = !isSpacePressed && !isPanning
  const backgroundListening =
    selectedLayer === "background" && layersDraggable
  const foregroundListening =
    selectedLayer === "foreground" && layersDraggable
  const frameListening = selectedLayer === "frame"

  return (
    <div className={cn("flex h-full w-full flex-col gap-3", className)}>
      <div
        ref={containerRef}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden rounded-lg bg-muted/20",
          isSpacePressed && !isPanning && "cursor-grab",
          isPanning && "cursor-grabbing",
          isSpacePressed && "select-none"
        )}
      >
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          scaleX={stageTransform.scale}
          scaleY={stageTransform.scale}
          x={stageTransform.x}
          y={stageTransform.y}
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
                  draggable={layersDraggable}
                  listening={backgroundListening}
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
                draggable={layersDraggable}
                listening={backgroundListening}
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
              draggable={layersDraggable}
              listening={foregroundListening}
              onDragEnd={() => handleDragEnd("foreground")}
              onTransformEnd={() => handleTransformEnd("foreground")}
            />
          </Layer>

          <Layer listening={false}>
            <ViewportDimOverlay
              stageSize={stageSize}
              stageX={stageTransform.x}
              stageY={stageTransform.y}
              scale={stageTransform.scale}
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
              listening={frameListening}
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
            onClick={resetView}
          >
            Reset view
          </Button>
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
        Drag layers to reposition. Scroll to zoom; hold Space or use the
        middle mouse button to pan. Content outside the frame will not appear
        in the final image.
      </p>
    </div>
  )
}
