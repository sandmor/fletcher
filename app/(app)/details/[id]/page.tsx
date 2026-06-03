"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Download,
  Loader2,
  Clock,
  Image as ImageIcon,
  ChevronsLeftRight,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function DetailPage() {
  const params = useParams()
  const router = useRouter()
  // Slider position state (0 to 100)
  const [sliderPos, setSliderPos] = useState(50)
  const [activeTab, setActiveTab] = useState<"result" | "compare" | "original">(
    "result"
  )

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id
  const id = rawId ? (rawId as Id<"jobs">) : null
  const job = useQuery(api.jobs.getJobById, id ? { id } : "skip")

  if (!id || job === null) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <ImageIcon className="h-8 w-8 text-muted-foreground opacity-50" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Image not found</h1>
          <p className="text-sm text-muted-foreground">
            The requested image might have been deleted.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/results")}
          className="mt-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to results
        </Button>
      </main>
    )
  }

  if (job === undefined) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  const showResult = job.status === "completed" && job.outputUrl

  const checkerboardStyle = {
    backgroundImage: `
      repeating-linear-gradient(45deg, var(--color-muted) 25%, transparent 25%, transparent 75%, var(--color-muted) 75%, var(--color-muted)), 
      repeating-linear-gradient(45deg, var(--color-muted) 25%, var(--color-background) 25%, var(--color-background) 75%, var(--color-muted) 75%, var(--color-muted))
    `,
    backgroundPosition: "0 0, 12px 12px",
    backgroundSize: "24px 24px",
    opacity: 0.5,
  }

  return (
    <main className="animate-fade-in mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="max-w-50 truncate text-xl font-bold tracking-tight sm:max-w-xs">
                {job.fileName}
              </h1>
              <StatusLabel status={job.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(job._creationTime).toLocaleString()}
            </p>
          </div>
        </div>

        {showResult && (
          <Button asChild size="lg" className="shadow-sm">
            <a href={job.outputUrl!} download={job.fileName}>
              <Download className="mr-2 h-4 w-4" />
              Download Result
            </a>
          </Button>
        )}
      </div>

      {showResult ? (
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <div className="flex rounded-full border bg-muted/50 p-1">
              {(["result", "compare", "original"] as const).map((tab) => (
                <button
                  key={tab}
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

          <Card className="overflow-hidden border-border bg-card/50 shadow-sm">
            <CardContent className="relative p-0">
              {/* Checkerboard background */}
              <div className="absolute inset-0" style={checkerboardStyle} />

              <div className="relative flex aspect-4/3 w-full items-center justify-center p-6 sm:aspect-video sm:p-12">
                {activeTab === "result" && (
                  <img
                    src={job.outputUrl!}
                    alt="Result"
                    className="animate-fade-in h-full w-full object-contain drop-shadow-2xl"
                  />
                )}

                {activeTab === "original" && (
                  <img
                    src={job.inputUrl}
                    alt="Original"
                    className="animate-fade-in h-full w-full object-contain shadow-2xl"
                  />
                )}

                {activeTab === "compare" && (
                  <div className="animate-fade-in relative h-full w-full overflow-hidden rounded-lg bg-background/50 shadow-2xl ring-1 ring-border/50">
                    <img
                      src={job.outputUrl!}
                      alt="Result"
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain select-none"
                    />

                    <img
                      src={job.inputUrl}
                      alt="Original"
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain select-none"
                      style={{
                        clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                      }}
                    />

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
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
        </div>
      ) : (
        /* Fallback for processing/pending/failed states */
        <Card className="overflow-hidden border-border shadow-sm">
          <CardContent className="relative p-0">
            <div className="absolute inset-0" style={checkerboardStyle} />
            <div className="relative flex aspect-4/3 w-full items-center justify-center p-6 sm:aspect-video">
              <img
                src={job.inputUrl}
                alt="Original"
                className="h-full w-full object-contain opacity-30 blur-sm"
              />

              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-md">
                {job.status === "processing" && (
                  <div className="animate-fade-in flex flex-col items-center gap-4">
                    <div className="rounded-full bg-primary/10 p-4">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight">
                      Removing background...
                    </span>
                  </div>
                )}
                {job.status === "pending" && (
                  <div className="animate-fade-in flex flex-col items-center gap-4">
                    <div className="rounded-full bg-secondary p-4">
                      <Clock className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <span className="text-lg font-medium text-muted-foreground">
                      Waiting in queue...
                    </span>
                  </div>
                )}
                {job.status === "failed" && (
                  <div className="animate-fade-in flex flex-col items-center gap-4 text-destructive">
                    <div className="rounded-full bg-destructive/10 p-4">
                      <AlertCircle className="h-10 w-10 text-destructive" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight">
                      Processing failed
                    </span>
                    {job.error && (
                      <span className="max-w-md rounded-lg border border-destructive/10 bg-destructive/5 px-6 py-2 text-center text-sm text-destructive/80">
                        {job.error}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function StatusLabel({ status }: { status: string }) {
  if (status === "completed")
    return (
      <Badge className="border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 shadow-none hover:bg-emerald-500/20">
        Completed
      </Badge>
    )
  if (status === "processing")
    return (
      <Badge className="border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary shadow-none hover:bg-primary/20">
        Processing
      </Badge>
    )
  if (status === "pending")
    return (
      <Badge variant="secondary" className="px-2 py-0.5 shadow-none">
        Pending
      </Badge>
    )
  if (status === "failed")
    return (
      <Badge variant="destructive" className="px-2 py-0.5 shadow-none">
        Failed
      </Badge>
    )
  return null
}
