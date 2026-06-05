"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import { useMutation } from "convex/react"
import { ChevronsLeftRight } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { Card, CardContent } from "@/components/ui/card"
import { CompositorCanvas } from "@/components/studio/compositor-canvas"
import { BackgroundPicker } from "@/components/studio/background-picker"
import { TransparencyBackground } from "@/components/studio/transparency-background"
import type { BackgroundConfig } from "@/lib/background"
import { cn } from "@/lib/utils"

type StudioTab = "edit" | "compare" | "original"

interface StudioViewerProps {
  job: Doc<"jobs"> & { outputUrl: string }
}

export function StudioViewer({ job }: StudioViewerProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>("edit")
  const [sliderPos, setSliderPos] = useState(50)
  const updateBackground = useMutation(api.jobs.updateJobBackground)

  const handleBackgroundChange = useCallback(
    (background: BackgroundConfig) => {
      void updateBackground({
        jobId: job._id as Id<"jobs">,
        background,
      })
    },
    [job._id, updateBackground]
  )

  const handleBackgroundClear = useCallback(() => {
    void updateBackground({
      jobId: job._id as Id<"jobs">,
      background: null,
    })
  }, [job._id, updateBackground])

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
          <CardContent className="relative p-0">
            {activeTab !== "edit" && <TransparencyBackground />}

            <div className="relative flex aspect-4/3 w-full items-center justify-center p-6 sm:aspect-video sm:p-12">
              {activeTab === "edit" && (
                <CompositorCanvas
                  foregroundUrl={job.outputUrl}
                  background={job.background}
                  className="animate-fade-in h-full w-full"
                />
              )}

              {activeTab === "original" && (
                <div className="animate-fade-in relative h-full w-full">
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
                <div className="animate-fade-in relative h-full w-full overflow-hidden rounded-lg bg-background/50 shadow-2xl ring-1 ring-border/50">
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
          </CardContent>
        </Card>

        {activeTab === "edit" && (
          <Card className="border-border bg-card/50 shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold tracking-tight">
                Background
              </h2>
              <BackgroundPicker
                value={job.background}
                onChange={handleBackgroundChange}
                onClear={handleBackgroundClear}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
