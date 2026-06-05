import type { BackgroundConfig } from "@/lib/background"

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    image.src = url
  })
}

export async function loadForegroundImage(
  foregroundUrl: string
): Promise<HTMLImageElement> {
  return loadImage(foregroundUrl)
}

export function compositeImage(
  foreground: HTMLImageElement,
  background?: BackgroundConfig
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = foreground.naturalWidth
  canvas.height = foreground.naturalHeight

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Canvas 2D context is unavailable")
  }

  if (background?.type === "solid") {
    context.fillStyle = background.color
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(foreground, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function compositeImageFromUrl(
  foregroundUrl: string,
  background?: BackgroundConfig
): Promise<HTMLCanvasElement> {
  const foreground = await loadForegroundImage(foregroundUrl)
  return compositeImage(foreground, background)
}

export function exportCompositedBlob(
  canvas: HTMLCanvasElement,
  format: "image/png" | "image/jpeg" = "image/png",
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export composited image"))
          return
        }
        resolve(blob)
      },
      format,
      format === "image/jpeg" ? quality : undefined
    )
  })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
