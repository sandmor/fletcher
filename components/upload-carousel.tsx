"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useDropzone } from "react-dropzone"
import type { UploadItem } from "@/hooks/use-upload-queue"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Send,
  Trash2,
  X,
} from "lucide-react"

interface UploadCarouselProps {
  items: UploadItem[]
  addFiles: (files: File[]) => void
  removeItem: (id: string) => void
  clearAll: () => void
  submitAll: () => void
  uploadingCount: number
  readyCount: number
  canSubmit: boolean
}

export function UploadCarousel({
  items,
  addFiles,
  removeItem,
  clearAll,
  submitAll,
  uploadingCount,
  readyCount,
  canSubmit,
}: UploadCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const prevLengthRef = useRef(0)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length) addFiles(acceptedFiles)
    },
    [addFiles]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    noClick: true,
    noKeyboard: true,
  })

  useEffect(() => {
    if (!api) return

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap())
    }

    onSelect()
    api.on("select", onSelect)
    api.on("reInit", onSelect)

    return () => {
      api.off("select", onSelect)
      api.off("reInit", onSelect)
    }
  }, [api])

  useEffect(() => {
    if (!api) return

    const prevLength = prevLengthRef.current

    if (items.length > prevLength) {
      const targetIndex = items.length - 1
      const scrollToNew = () => api.scrollTo(targetIndex)
      scrollToNew()
      api.on("reInit", scrollToNew)
      prevLengthRef.current = items.length
      return () => {
        api.off("reInit", scrollToNew)
      }
    }

    if (items.length < prevLength && api.selectedScrollSnap() >= items.length) {
      api.scrollTo(Math.max(0, items.length - 1))
    }

    prevLengthRef.current = items.length
  }, [api, items.length])

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 transition-all duration-200",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border bg-card"
      )}
    >
      <input {...getInputProps()} />

      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <span className="text-sm font-semibold">
          {current + 1} / {items.length}
        </span>
        <div className="flex items-center gap-3">
          {uploadingCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Uploading {uploadingCount}…
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              clearAll()
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear all
          </Button>
        </div>
      </div>

      <Carousel setApi={setApi} className="w-full">
        <CarouselContent className="ml-0">
          {items.map((item) => (
            <CarouselItem key={item.id} className="pl-0">
              <div className="relative aspect-4/3 w-full bg-muted">
                <Image
                  src={item.previewUrl}
                  alt={item.fileName}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-contain"
                />

                {item.status === "uploading" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/50 backdrop-blur-[1px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm font-medium text-primary">
                      Uploading…
                    </span>
                  </div>
                )}

                {item.status === "uploaded" && (
                  <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-emerald-600 shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready
                  </div>
                )}

                {item.status === "error" && (
                  <div className="absolute inset-x-4 top-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.error}</span>
                  </div>
                )}

                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-3 h-8 w-8 bg-background/90 shadow-sm hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeItem(item.id)
                  }}
                  aria-label={`Remove ${item.fileName}`}
                >
                  <X className="h-4 w-4" />
                </Button>

                <p className="absolute left-4 bottom-20 max-w-[calc(100%-2rem)] truncate rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                  {item.fileName}
                </p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {items.length > 1 && (
          <>
            <CarouselPrevious className="left-3 top-[calc(50%-2rem)] -translate-y-1/2 border-border/50 bg-background/90 shadow-md" />
            <CarouselNext className="right-3 top-[calc(50%-2rem)] -translate-y-1/2 border-border/50 bg-background/90 shadow-md" />
          </>
        )}
      </Carousel>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background via-background/95 to-transparent px-4 pb-4 pt-16">
        <div className="pointer-events-auto flex flex-col gap-3">
          <p className="text-center text-xs text-muted-foreground">
            You can also drop more images here
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="flex-1 shadow-lg"
              disabled={!canSubmit}
              onClick={(e) => {
                e.stopPropagation()
                void submitAll()
              }}
            >
              <Send className="mr-2 h-5 w-5" />
              {uploadingCount > 0
                ? `Waiting for ${uploadingCount} upload${uploadingCount > 1 ? "s" : ""}…`
                : `Submit ${readyCount} job${readyCount > 1 ? "s" : ""}`}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1 bg-background/95"
              onClick={(e) => {
                e.stopPropagation()
                open()
              }}
            >
              <ImagePlus className="mr-2 h-5 w-5" />
              Add images
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
