"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, AlertCircle, Loader2, ImageOff, Download } from "lucide-react"
import { cn } from "@/lib/utils"

type Filter = "all" | "completed" | "processing" | "pending" | "failed"

export default function ResultsPage() {
  const jobs = useQuery(api.jobs.getQueue) ?? []
  const [filter, setFilter] = useState<Filter>("all")

  const jobsMemo = useMemo(() => jobs, [jobs])

  const filtered = useMemo(() => {
    if (filter === "all") return jobsMemo
    return jobsMemo.filter((j) => j.status === filter)
  }, [jobsMemo, filter])

  const counts = useMemo(() => {
    return {
      all: jobsMemo.length,
      completed: jobsMemo.filter((j) => j.status === "completed").length,
      processing: jobsMemo.filter((j) => j.status === "processing").length,
      pending: jobsMemo.filter((j) => j.status === "pending").length,
      failed: jobsMemo.filter((j) => j.status === "failed").length,
    }
  }, [jobsMemo])

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "completed", label: "Completed", count: counts.completed },
    { value: "processing", label: "Processing", count: counts.processing },
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "failed", label: "Failed", count: counts.failed },
  ]

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>

          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  filter === tab.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "flex h-5 items-center justify-center rounded-full px-1.5 text-[10px]",
                    filter === tab.value
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="animate-fade-in flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-border/50 bg-card/50 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ImageOff className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold">No images found</h3>
              <p className="text-sm text-muted-foreground">
                No images match this filter. Try changing your selection.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/">Upload images</Link>
            </Button>
          </div>
        ) : (
          <div className="animate-fade-in grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((job) => (
              <JobCard key={job._id} job={job} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function JobCard({
  job,
}: {
  job: NonNullable<
    ReturnType<typeof useQuery<typeof api.jobs.getQueue>>
  >[number]
}) {
  const showResult = job.status === "completed" && job.outputUrl
  const isFailed = job.status === "failed"
  const isPendingOrProcessing =
    job.status === "pending" || job.status === "processing"

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-md hover:ring-1 hover:ring-primary/20">
      <CardContent className="p-0">
        <Link
          href={`/details/${job._id}`}
          className="relative block aspect-square w-full overflow-hidden bg-muted"
        >
          <img
            src={showResult ? job.outputUrl! : job.inputUrl}
            alt={job.fileName}
            className={cn(
              "h-full w-full object-cover transition-transform duration-700 group-hover:scale-105",
              isFailed && "grayscale"
            )}
          />

          {/* Overlays */}
          {isPendingOrProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm">
              {job.status === "processing" ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    Processing…
                  </span>
                </>
              ) : (
                <>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Pending
                  </span>
                </>
              )}
            </div>
          )}

          {isFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <span className="text-sm font-semibold text-destructive">
                Failed
              </span>
            </div>
          )}

          {/* Shimmer for processing */}
          {job.status === "processing" && (
            <div className="animate-shimmer pointer-events-none absolute inset-0" />
          )}

          {/* Hover download overlay for completed */}
          {showResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
              <Button
                variant="default"
                size="sm"
                className="shadow-lg"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const a = document.createElement("a")
                  a.href = job.outputUrl!
                  a.download = job.fileName
                  a.click()
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          )}

          <div className="absolute top-3 right-3">
            <StatusBadge status={job.status} />
          </div>
        </Link>
        <div className="border-t border-border/50 px-4 py-4">
          <p
            className="truncate text-sm font-medium text-foreground"
            title={job.fileName}
          >
            {job.fileName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(job._creationTime).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return (
      <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shadow-none hover:bg-emerald-500/20">
        Completed
      </Badge>
    )
  if (status === "processing")
    return (
      <Badge className="border border-primary/20 bg-primary/10 text-primary shadow-none hover:bg-primary/20">
        Processing
      </Badge>
    )
  if (status === "pending")
    return (
      <Badge variant="secondary" className="shadow-none">
        Pending
      </Badge>
    )
  if (status === "failed")
    return (
      <Badge variant="destructive" className="shadow-none">
        Failed
      </Badge>
    )
  return null
}
