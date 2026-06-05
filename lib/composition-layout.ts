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
  } else if (background) {
    layout.background = { x: 0, y: 0, width, height }
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

/** Visible stage area in shape coordinates (includes letterbox). */
export function getStageViewportInShapeCoords(
  stageWidth: number,
  stageHeight: number,
  workspaceWidth: number,
  workspaceHeight: number,
  displayScale: number
): LayerRect {
  if (displayScale <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const stageOffsetX = (stageWidth - workspaceWidth * displayScale) / 2
  const stageOffsetY = (stageHeight - workspaceHeight * displayScale) / 2

  return {
    x: -stageOffsetX / displayScale,
    y: -stageOffsetY / displayScale,
    width: stageWidth / displayScale,
    height: stageHeight / displayScale,
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
  if (previous.type !== next.type) return true
  if (previous.type === "image" && next.type === "image") {
    return previous.imageUrl !== next.imageUrl
  }
  return false
}
