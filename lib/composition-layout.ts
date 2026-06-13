import type { BackgroundConfig } from "@/lib/background"

export type LayerRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CompositionLayout = {
  width: number
  height: number
  foreground: LayerRect
  background?: LayerRect
}

export const MIN_FRAME_SIZE = 32
export const WORKSPACE_PADDING = 120

export function coverFitRect(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
): LayerRect {
  const scale = Math.max(
    frameWidth / imageWidth,
    frameHeight / imageHeight
  )
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: (frameWidth - width) / 2,
    y: (frameHeight - height) / 2,
    width,
    height,
  }
}

export function createDefaultLayout(
  foreground: HTMLImageElement,
  background?: HTMLImageElement | BackgroundConfig
): CompositionLayout {
  const width = foreground.naturalWidth
  const height = foreground.naturalHeight

  const layout: CompositionLayout = {
    width,
    height,
    foreground: { x: 0, y: 0, width, height },
  }

  if (background instanceof HTMLImageElement) {
    layout.background = coverFitRect(
      background.naturalWidth,
      background.naturalHeight,
      width,
      height
    )
  }

  return layout
}

export function isBackgroundLayerEditable(background: BackgroundConfig): boolean {
  return background.type === "image"
}

export function normalizeCompositionLayout(
  layout: CompositionLayout,
  background: BackgroundConfig
): CompositionLayout {
  if (background.type === "solid") {
    const { background: _backgroundLayer, ...rest } = layout
    return rest
  }

  if (!layout.background) {
    return {
      ...layout,
      background: { x: 0, y: 0, width: layout.width, height: layout.height },
    }
  }

  return layout
}

export function adaptCompositionLayoutOnBackgroundUpdate(
  layout: CompositionLayout | undefined,
  previous: BackgroundConfig | undefined,
  next: BackgroundConfig | null,
  imageDimensions?: { width: number; height: number }
): CompositionLayout | undefined {
  if (!layout) return undefined
  if (shouldClearLayoutOnBackgroundChange(previous, next)) return undefined

  if (next?.type === "solid") {
    return normalizeCompositionLayout(layout, next)
  }

  if (next?.type === "image" && imageDimensions) {
    return {
      ...layout,
      background: coverFitRect(
        imageDimensions.width,
        imageDimensions.height,
        layout.width,
        layout.height
      ),
    }
  }

  return layout
}

export function getWorkspaceSize(layout: CompositionLayout) {
  return {
    width: layout.width + WORKSPACE_PADDING * 2,
    height: layout.height + WORKSPACE_PADDING * 2,
  }
}

export function getFrameOffset() {
  return { x: WORKSPACE_PADDING, y: WORKSPACE_PADDING }
}

export function layerToStageCoords(layer: LayerRect): LayerRect {
  const offset = getFrameOffset()
  return {
    x: offset.x + layer.x,
    y: offset.y + layer.y,
    width: layer.width,
    height: layer.height,
  }
}

export function stageToLayerCoords(stageRect: LayerRect): LayerRect {
  const offset = getFrameOffset()
  return {
    x: stageRect.x - offset.x,
    y: stageRect.y - offset.y,
    width: stageRect.width,
    height: stageRect.height,
  }
}

export function clampFrameSize(width: number, height: number) {
  return {
    width: Math.max(MIN_FRAME_SIZE, width),
    height: Math.max(MIN_FRAME_SIZE, height),
  }
}

export function getDisplayScale(
  stageWidth: number,
  stageHeight: number,
  workspaceWidth: number,
  workspaceHeight: number
) {
  return Math.min(
    stageWidth / workspaceWidth,
    stageHeight / workspaceHeight,
    1
  )
}

export type Point = {
  x: number
  y: number
}

export const MIN_USER_ZOOM = 0.25
export const MAX_USER_ZOOM = 8

export function clampUserZoom(zoom: number) {
  return Math.min(MAX_USER_ZOOM, Math.max(MIN_USER_ZOOM, zoom))
}

export function getFitCenterOffset(
  stageWidth: number,
  stageHeight: number,
  workspaceWidth: number,
  workspaceHeight: number,
  fitScale: number
): Point {
  return {
    x: (stageWidth - workspaceWidth * fitScale) / 2,
    y: (stageHeight - workspaceHeight * fitScale) / 2,
  }
}

export function getEffectiveStageTransform(
  stageWidth: number,
  stageHeight: number,
  workspaceWidth: number,
  workspaceHeight: number,
  fitScale: number,
  userZoom: number,
  panOffset: Point
) {
  const center = getFitCenterOffset(
    stageWidth,
    stageHeight,
    workspaceWidth,
    workspaceHeight,
    fitScale
  )
  const scale = fitScale * userZoom

  return {
    scale,
    x: center.x + panOffset.x,
    y: center.y + panOffset.y,
  }
}

/** Visible stage area in shape coordinates (includes letterbox). */
export function getStageViewportInShapeCoords(
  stageWidth: number,
  stageHeight: number,
  stageX: number,
  stageY: number,
  scale: number
): LayerRect {
  if (scale <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  return {
    x: -stageX / scale,
    y: -stageY / scale,
    width: stageWidth / scale,
    height: stageHeight / scale,
  }
}

export function zoomAtPointer(
  oldScale: number,
  oldPosition: Point,
  pointer: Point,
  scaleFactor: number,
  minScale: number,
  maxScale: number
) {
  const newScale = Math.min(
    maxScale,
    Math.max(minScale, oldScale * scaleFactor)
  )

  const mousePointTo = {
    x: (pointer.x - oldPosition.x) / oldScale,
    y: (pointer.y - oldPosition.y) / oldScale,
  }

  return {
    scale: newScale,
    position: {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    },
  }
}

/** Four rects covering viewport outside the frame hole (for dim overlay). */
export function getViewportDimRects(
  viewport: LayerRect,
  hole: LayerRect
): LayerRect[] {
  const viewportRight = viewport.x + viewport.width
  const viewportBottom = viewport.y + viewport.height
  const holeRight = hole.x + hole.width
  const holeBottom = hole.y + hole.height

  const rects: LayerRect[] = [
    {
      x: viewport.x,
      y: viewport.y,
      width: viewport.width,
      height: hole.y - viewport.y,
    },
    {
      x: viewport.x,
      y: holeBottom,
      width: viewport.width,
      height: viewportBottom - holeBottom,
    },
    {
      x: viewport.x,
      y: hole.y,
      width: hole.x - viewport.x,
      height: hole.height,
    },
    {
      x: holeRight,
      y: hole.y,
      width: viewportRight - holeRight,
      height: hole.height,
    },
  ]

  return rects.filter(
    (rect) => rect.width > 0 && rect.height > 0
  )
}

export function shouldClearLayoutOnBackgroundChange(
  previous: BackgroundConfig | undefined,
  next: BackgroundConfig | null
): boolean {
  if (next === null) return true
  if (!previous) return false
  if (previous.type === "image" && next.type === "image") {
    return previous.imageUrl !== next.imageUrl
  }
  return false
}
