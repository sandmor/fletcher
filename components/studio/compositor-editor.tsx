"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Stage,
  Layer,
  Rect,
  Image as KonvaImage,
  Transformer,
} from "react-konva"
import type Konva from "konva"
import {
  Hand,
  Layers,
  Loader2,
  Maximize,
  MousePointer2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
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
  isBackgroundLayerEditable,
  layerToStageCoords,
  normalizeCompositionLayout,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

type SelectableLayer = "foreground" | "background" | "frame"

const FRAME_STROKE = "#3b82f6"
const TOUCH_ANCHOR_SIZE = 14
const POINTER_ANCHOR_SIZE = 8

type FrameBounds = LayerRect

const DIM_COLOR = "rgba(0, 0, 0, 0.45)"

const LAYER_OPTIONS = [
  ["foreground", "Foreground"],
  ["background", "Background"],
  ["frame", "Frame"],
] as const

function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function isStageDrag(e: Konva.KonvaEventObject<DragEvent>) {
  return e.target === e.target.getStage()
}

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
  foregroundUrl: string
  background: BackgroundConfig
  initialLayout?: CompositionLayout
  onDone: (layout: CompositionLayout) => Promise<void>
  saving?: boolean
  className?: string
  /** Optional panel (e.g. the background picker) embedded into the side rail / mobile sheet. */
  backgroundPanel?: ReactNode
}

export function CompositorEditor({
  foregroundUrl,
  background,
  initialLayout,
  onDone,
  saving = false,
  className,
  backgroundPanel,
}: CompositorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const cameraAnimRef = useRef<number | null>(null)
  const foregroundRef = useRef<Konva.Image>(null)
  const backgroundRef = useRef<Konva.Image | Konva.Rect>(null)
  const frameRef = useRef<Konva.Rect>(null)
  const frameTransformRafRef = useRef<number | null>(null)
  const liveFrameRef = useRef<FrameBounds | null>(null)
  const pinchRef = useRef<{ distance: number; midpoint: Point } | null>(null)

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
  const [panMode, setPanMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [coarsePointer, setCoarsePointer] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches
  )
  const initialLayoutRef = useRef(initialLayout)

  const backgroundIdentityKey =
    background.type === "solid" ? "solid" : `image:${background.imageUrl}`

  const backgroundLayerEditable = isBackgroundLayerEditable(background)
  const visibleLayerOptions = LAYER_OPTIONS.filter(
    ([id]) => backgroundLayerEditable || id !== "background"
  )

  useEffect(() => {
    if (!backgroundLayerEditable && selectedLayer === "background") {
      setSelectedLayer("foreground")
    }
  }, [backgroundLayerEditable, selectedLayer])

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
    const query = window.matchMedia("(pointer: coarse)")
    const update = () => setCoarsePointer(query.matches)
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    return () => {
      if (frameTransformRafRef.current !== null) {
        cancelAnimationFrame(frameTransformRafRef.current)
      }
      if (cameraAnimRef.current !== null) {
        cancelAnimationFrame(cameraAnimRef.current)
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

  const syncStagePan = useCallback(() => {
    const stage = stageRef.current
    if (!stage || !layout) return

    const workspace = getWorkspaceSize(layout)
    const center = getFitCenterOffset(
      stageSize.width,
      stageSize.height,
      workspace.width,
      workspace.height,
      fitScale
    )
    setPanOffset({
      x: stage.x() - center.x,
      y: stage.y() - center.y,
    })
  }, [layout, stageSize, fitScale])

  const zoomAroundPointer = useCallback(
    (pointer: Point, scaleFactor: number) => {
      if (!layout) return
      const workspace = getWorkspaceSize(layout)
      const center = getFitCenterOffset(
        stageSize.width,
        stageSize.height,
        workspace.width,
        workspace.height,
        fitScale
      )
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
    },
    [layout, fitScale, userZoom, panOffset, stageSize]
  )

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
      zoomAroundPointer(pointer, Math.exp(-event.deltaY * 0.002))
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [layout, zoomAroundPointer])

  // Touch: pinch-to-zoom (two fingers). One-finger pan is handled by Konva Stage drag.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !layout) return

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        stageRef.current?.stopDrag()
        const [a, b] = [event.touches[0], event.touches[1]]
        const midpointClient = {
          x: (a.clientX + b.clientX) / 2,
          y: (a.clientY + b.clientY) / 2,
        }
        const rect = container.getBoundingClientRect()
        pinchRef.current = {
          distance: touchDistance(a, b),
          midpoint: {
            x: midpointClient.x - rect.left,
            y: midpointClient.y - rect.top,
          },
        }
        event.preventDefault()
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (pinchRef.current && event.touches.length === 2) {
        event.preventDefault()
        const [a, b] = [event.touches[0], event.touches[1]]
        const distance = touchDistance(a, b)
        const factor = distance / pinchRef.current.distance
        if (factor && Number.isFinite(factor)) {
          zoomAroundPointer(pinchRef.current.midpoint, factor)
        }
        const rect = container.getBoundingClientRect()
        pinchRef.current = {
          distance,
          midpoint: {
            x: (a.clientX + b.clientX) / 2 - rect.left,
            y: (a.clientY + b.clientY) / 2 - rect.top,
          },
        }
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null
    }

    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    })
    container.addEventListener("touchmove", handleTouchMove, { passive: false })
    container.addEventListener("touchend", handleTouchEnd)
    container.addEventListener("touchcancel", handleTouchEnd)
    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
      container.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [layout, zoomAroundPointer])

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
      stageRef.current?.stopDrag()
      setIsPanning(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const animateCameraTo = useCallback(
    (target: { userZoom: number; panOffset: Point }, durationMs = 180) => {
      if (cameraAnimRef.current !== null) {
        cancelAnimationFrame(cameraAnimRef.current)
      }

      const startZoom = userZoom
      const startPan = panOffset
      const startTime = performance.now()

      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs)
        const eased = 1 - (1 - t) ** 3

        setUserZoom(startZoom + (target.userZoom - startZoom) * eased)
        setPanOffset({
          x: startPan.x + (target.panOffset.x - startPan.x) * eased,
          y: startPan.y + (target.panOffset.y - startPan.y) * eased,
        })

        if (t < 1) {
          cameraAnimRef.current = requestAnimationFrame(tick)
        } else {
          cameraAnimRef.current = null
        }
      }

      cameraAnimRef.current = requestAnimationFrame(tick)
    },
    [userZoom, panOffset]
  )

  const resetView = useCallback(() => {
    animateCameraTo({ userZoom: 1, panOffset: { x: 0, y: 0 } })
  }, [animateCameraTo])

  const zoomByButton = useCallback(
    (factor: number) => {
      if (!layout) return

      const workspace = getWorkspaceSize(layout)
      const center = getFitCenterOffset(
        stageSize.width,
        stageSize.height,
        workspace.width,
        workspace.height,
        fitScale
      )
      const pointer = { x: stageSize.width / 2, y: stageSize.height / 2 }
      const oldScale = fitScale * userZoom
      const oldPosition = {
        x: center.x + panOffset.x,
        y: center.y + panOffset.y,
      }
      const { scale, position } = zoomAtPointer(
        oldScale,
        oldPosition,
        pointer,
        factor,
        fitScale * MIN_USER_ZOOM,
        fitScale * MAX_USER_ZOOM
      )

      animateCameraTo({
        userZoom: clampUserZoom(scale / fitScale),
        panOffset: {
          x: position.x - center.x,
          y: position.y - center.y,
        },
      })
    },
    [layout, fitScale, userZoom, panOffset, stageSize, animateCameraTo]
  )

  const updateLayoutState = useCallback(
    (updater: (current: CompositionLayout) => CompositionLayout) => {
      setLayout((current) => {
        if (!current) return current
        return updater(current)
      })
    },
    []
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
  }, [foregroundImage, backgroundImage, background, resetView])

  const handleDone = useCallback(async () => {
    if (!layout || isSaving || saving) return

    setIsSaving(true)
    try {
      await onDone(normalizeCompositionLayout(layout, background))
    } catch {
      // Error surfaced via publish hook toast
    } finally {
      setIsSaving(false)
    }
  }, [background, isSaving, layout, onDone, saving])

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

  const zoomPercent = Math.round(userZoom * 100)
  const saveBusy = isSaving || saving

  // ── Shared control groups, reused by the desktop rail and the mobile sheet ──
  const layerSelector = (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        Layer
      </p>
      <div
        className={cn(
          "grid gap-1.5",
          visibleLayerOptions.length === 2 ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        {visibleLayerOptions.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => selectLayer(id)}
            className={cn(
              "border px-2 py-2 text-xs font-medium transition-colors",
              selectedLayer === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  const actionButtons = (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => void handleReset()}
      >
        <RotateCcw />
        Reset to default
      </Button>
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={saveBusy || !layout}
        onClick={() => void handleDone()}
      >
        {saveBusy ? (
          <>
            <Loader2 className="animate-spin" />
            Saving...
          </>
        ) : (
          "Done"
        )}
      </Button>
    </div>
  )

  const panelContent = (
    <div className="flex flex-col gap-6">
      {layerSelector}
      {backgroundPanel && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Background
          </p>
          {backgroundPanel}
        </div>
      )}
      {actionButtons}
    </div>
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
          "flex h-full w-full items-center justify-center canvas-backdrop",
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
  const layersDraggable = !isSpacePressed && !isPanning && !panMode
  const backgroundListening =
    selectedLayer === "background" && layersDraggable
  const foregroundListening =
    selectedLayer === "foreground" && layersDraggable
  const frameListening = selectedLayer === "frame"
  const anchorSize = coarsePointer ? TOUCH_ANCHOR_SIZE : POINTER_ANCHOR_SIZE

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col md:flex-row md:items-stretch",
        className
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "canvas-backdrop relative min-h-0 flex-1 touch-none overflow-hidden",
          (isSpacePressed || panMode) && !isPanning && "cursor-grab",
          isPanning && "cursor-grabbing",
          (isSpacePressed || panMode) && "select-none"
        )}
      >
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={stageTransform.scale}
          scaleY={stageTransform.scale}
          x={stageTransform.x}
          y={stageTransform.y}
          draggable={panMode || isSpacePressed}
          onDragStart={(e) => {
            if (!isStageDrag(e)) return
            setIsPanning(true)
          }}
          onDragMove={(e) => {
            if (!isStageDrag(e)) return
            syncStagePan()
          }}
          onDragEnd={(e) => {
            if (!isStageDrag(e)) return
            syncStagePan()
            setIsPanning(false)
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
                  draggable={layersDraggable}
                  listening={backgroundListening}
                  onDragEnd={() => handleDragEnd("background")}
                  onTransformEnd={() => handleTransformEnd("background")}
                />
              )}

            {background.type === "solid" && (
              <Rect
                x={frameOffset.x}
                y={frameOffset.y}
                width={layout.width}
                height={layout.height}
                fill={background.color}
                listening={false}
                draggable={false}
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
              anchorSize={anchorSize}
              anchorCornerRadius={2}
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

        {/* Floating zoom + tool controls, anchored to the canvas */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 sm:p-4">
          <div className="pointer-events-auto flex items-center gap-1 border border-border/60 bg-background/80 p-1 shadow-lg backdrop-blur-md">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              onClick={() => zoomByButton(0.8)}
            >
              <ZoomOut />
            </Button>
            <span className="min-w-12 text-center text-xs font-medium tabular-nums text-muted-foreground">
              {zoomPercent}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              onClick={() => zoomByButton(1.2)}
            >
              <ZoomIn />
            </Button>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Fit to screen"
              onClick={resetView}
            >
              <Maximize />
            </Button>
            <Button
              type="button"
              variant={panMode ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={panMode ? "Switch to select tool" : "Switch to pan tool"}
              aria-pressed={panMode}
              onClick={() => setPanMode((value) => !value)}
            >
              {panMode ? <Hand /> : <MousePointer2 />}
            </Button>
          </div>

          {/* Mobile-only: open the options sheet */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="pointer-events-auto shadow-lg md:hidden"
            onClick={() => setMobilePanelOpen(true)}
          >
            <Layers />
            Options
          </Button>
        </div>
      </div>

      {/* Desktop side rail */}
      <aside
        className="hidden w-(--editor-panel-w) shrink-0 flex-col border-l border-border bg-card md:flex"
      >
        <ScrollArea className="flex-1">
          <div className="p-5">{panelContent}</div>
        </ScrollArea>
      </aside>

      {/* Mobile options sheet */}
      <Drawer open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
        <DrawerContent className="md:hidden">
          <DrawerTitle className="px-5 pt-2">Composition</DrawerTitle>
          <ScrollArea className="max-h-[65vh]">
            <div
              className="p-5"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            >
              {panelContent}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
