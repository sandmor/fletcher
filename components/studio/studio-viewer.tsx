"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react"
import Image from "next/image"
import { ChevronsLeftRight, Sliders } from "lucide-react"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CompositorPreview } from "@/components/studio/compositor-canvas"
import { BackgroundPicker } from "@/components/studio/background-picker"
import { TransparencyBackground } from "@/components/studio/transparency-background"
import { usePublishStudioResult } from "@/hooks/use-publish-studio-result"
import { useStudioJobSync } from "@/hooks/use-studio-job-sync"
import type { BackgroundConfig } from "@/lib/background"
import type { CompositionLayout } from "@/lib/composition-layout"
import { getStudioRevision } from "@/lib/studio/job-studio-revision"
import { cn } from "@/lib/utils"

const CompositionEditorOverlay = dynamic(
  () =>
    import("@/components/studio/composition-editor-overlay").then(
      (mod) => mod.CompositionEditorOverlay
    ),
  { ssr: false, loading: () => null }
)

type StudioTab = "edit" | "compare" | "original"

interface StudioViewerProps {
  job: Doc<"jobs"> & { outputUrl: string }
  publishEnabledRef: MutableRefObject<boolean>
}

export function StudioViewer({ job, publishEnabledRef }: StudioViewerProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>("edit")
  const [sliderPos, setSliderPos] = useState(50)
  const [advancedLayout, setAdvancedLayout] = useState(false)
  const [previewBackground, setPreviewBackground] = useState<
    BackgroundConfig | undefined
  >()
  const [editorSessionKey, setEditorSessionKey] = useState(
    () => `${job._id}-${getStudioRevision(job)}`
  )
  const [layoutResetToken, setLayoutResetToken] = useState(0)
  const [overlaySessionBackground, setOverlaySessionBackground] =
    useState<BackgroundConfig | null>(null)
  const skipLayoutResetOnOwnAckRef = useRef(false)

  const resetLocalState = useCallback(() => {
    setPreviewBackground(undefined)
  }, [])

  const onOwnPublishAck = useCallback(
    (updatedJob: Doc<"jobs"> & { outputUrl: string }) => {
      if (!advancedLayout || updatedJob.compositionLayout) return

      if (skipLayoutResetOnOwnAckRef.current) {
        skipLayoutResetOnOwnAckRef.current = false
        return
      }

      setLayoutResetToken((token) => token + 1)
    },
    [advancedLayout]
  )

  const {
    publishing,
    lastPublishFailedRef,
    publishSolidBackground,
    publishBackgroundImage,
    publishBackgroundClear,
    publishCompositionLayout,
    clearPendingSolidPublish,
    cancelPublishQueue,
  } = usePublishStudioResult(job._id as Id<"jobs">, job.outputUrl, {
    enabled: publishEnabledRef.current,
    enabledRef: publishEnabledRef,
    onFailure: resetLocalState,
  })

  useStudioJobSync({
    job,
    publishing,
    advancedLayout,
    lastPublishFailedRef,
    onResetLocalState: resetLocalState,
    clearPendingPublish: clearPendingSolidPublish,
    cancelPublishQueue,
    setAdvancedLayout,
    onOwnPublishAck,
  })

  const handleOverlayClosed = useCallback(() => {
    setEditorSessionKey(`${job._id}-${getStudioRevision(job)}`)
    setLayoutResetToken(0)
    setOverlaySessionBackground(null)
    skipLayoutResetOnOwnAckRef.current = false
  }, [job])

  const openAdvancedLayout = useCallback(() => {
    const background = previewBackground ?? job.background
    if (!background) return

    setEditorSessionKey(`${job._id}-${getStudioRevision(job)}`)
    setOverlaySessionBackground(background)
    setAdvancedLayout(true)
  }, [job, previewBackground])

  const activeBackground = previewBackground ?? job.background

  // Keep overlay session background in sync while the editor is open.
  useEffect(() => {
    if (advancedLayout && activeBackground) {
      setOverlaySessionBackground(activeBackground)
    }
  }, [advancedLayout, activeBackground])

  const handleSolidChange = useCallback(
    (background: { type: "solid"; color: string }) => {
      setPreviewBackground(background)
      publishSolidBackground(background.color, job.compositionLayout)
    },
    [job.compositionLayout, publishSolidBackground]
  )

  const handleImageUploaded = useCallback(
    async (background: {
      type: "image"
      imageUrl: string
      fileName: string
    }) => {
      skipLayoutResetOnOwnAckRef.current = true
      setPreviewBackground(background)
      try {
        await publishBackgroundImage(background)
      } catch {
        skipLayoutResetOnOwnAckRef.current = false
        setPreviewBackground(undefined)
      }
    },
    [publishBackgroundImage]
  )

  const handleBackgroundClear = useCallback(async () => {
    setAdvancedLayout(false)
    setPreviewBackground(undefined)
    await publishBackgroundClear()
  }, [publishBackgroundClear])

  const handleCompositionDone = useCallback(
    async (layout: CompositionLayout) => {
      if (!activeBackground) return

      try {
        await publishCompositionLayout(layout, activeBackground)
      } finally {
        setAdvancedLayout(false)
      }
    },
    [activeBackground, publishCompositionLayout]
  )

  const showAdvancedEntry = Boolean(activeBackground) && !advancedLayout
  const overlayPickerBackground =
    activeBackground ?? overlaySessionBackground ?? undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <div className="flex rounded-full border bg-muted/50 p-1">
          {(["edit", "compare", "original"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative rounded-full px-6 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-6",
          activeTab === "edit" ? "lg:grid-cols-[minmax(0,1fr)_280px]" : "grid-cols-1"
        )}
      >
        <Card className="overflow-hidden border-border bg-card/50 shadow-sm">
          <CardContent className="relative flex flex-col p-0">
            {activeTab !== "edit" && <TransparencyBackground />}

            <div
              key={activeTab}
              className={cn(
                "relative flex aspect-4/3 w-full items-center justify-center p-6 sm:aspect-video sm:p-12",
                "animate-fade-in"
              )}
            >
              {activeTab === "edit" && (
                <CompositorPreview
                  foregroundUrl={job.outputUrl}
                  background={activeBackground}
                  layout={job.compositionLayout}
                  className="h-full w-full"
                />
              )}

              {activeTab === "original" && (
                <div className="relative h-full w-full">
                  <Image
                    src={job.inputUrl}
                    alt="Original"
                    fill
                    sizes="(min-width: 640px) 80vw, 100vw"
                    className="object-contain shadow-2xl"
                  />
                </div>
              )}

              {activeTab === "compare" && (
                <div className="relative h-full w-full overflow-hidden rounded-lg bg-background/50 shadow-2xl ring-1 ring-border/50">
                  <Image
                    src={job.outputUrl}
                    alt="Result"
                    fill
                    sizes="(min-width: 640px) 80vw, 100vw"
                    className="pointer-events-none object-contain select-none"
                  />

                  <Image
                    src={job.inputUrl}
                    alt="Original"
                    fill
                    sizes="(min-width: 640px) 80vw, 100vw"
                    className="pointer-events-none object-contain select-none"
                    style={{
                      clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                    }}
                  />

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderPos}
                    onChange={(event) => setSliderPos(Number(event.target.value))}
                    className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                  />

                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-primary shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    style={{
                      left: `${sliderPos}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background">
                      <ChevronsLeftRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeTab === "edit" && showAdvancedEntry && (
              <div className="animate-fade-in flex items-center justify-between gap-3 border-t border-border px-6 py-3">
                <p className="text-xs text-muted-foreground">
                  Reposition layers, resize, and crop in the full editor.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={publishing}
                  onClick={openAdvancedLayout}
                >
                  <Sliders />
                  Edit composition
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {activeTab === "edit" && (
          <Card className="border-border bg-card/50 shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold tracking-tight">
                Background
              </h2>
              <BackgroundPicker
                jobId={job._id}
                value={activeBackground}
                onSolidChange={handleSolidChange}
                onImageUploaded={handleImageUploaded}
                onClear={() => void handleBackgroundClear()}
                disabled={publishing || advancedLayout}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {overlaySessionBackground && (
        <CompositionEditorOverlay
          open={advancedLayout}
          onClose={() => setAdvancedLayout(false)}
          onClosed={handleOverlayClosed}
          editorKey={editorSessionKey}
          layoutResetToken={layoutResetToken}
          fileName={job.fileName}
          foregroundUrl={job.outputUrl}
          background={overlaySessionBackground}
          initialLayout={job.compositionLayout}
          onDone={handleCompositionDone}
          saving={publishing}
          backgroundPanel={
            <BackgroundPicker
              jobId={job._id}
              value={overlayPickerBackground}
              onSolidChange={handleSolidChange}
              onImageUploaded={handleImageUploaded}
              onClear={() => void handleBackgroundClear()}
              disabled={publishing}
            />
          }
        />
      )}
    </div>
  )
}
