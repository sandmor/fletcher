"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Clock, AlertCircle, Loader2, ImageOff } from "lucide-react"

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
          <Select
            value={filter}
            onValueChange={(v: string) => setFilter(v as Filter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({counts.all})</SelectItem>
              <SelectItem value="completed">
                Completed ({counts.completed})
              </SelectItem>
              <SelectItem value="processing">
                Processing ({counts.processing})
              </SelectItem>
              <SelectItem value="pending">
                Pending ({counts.pending})
              </SelectItem>
              <SelectItem value="failed">Failed ({counts.failed})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
            <ImageOff className="h-10 w-10 text-muted-foreground" />
            <div className="text-muted-foreground">
              No images match this filter.
            </div>
            <Link
              href="/"
              className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Upload images
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    <Card className="overflow-hidden transition-colors hover:bg-accent/40">
      <CardContent className="p-0">
        <Link href={`/details/${job._id}`} className="group block">
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <img
              src={showResult ? job.outputUrl! : job.inputUrl}
              alt={job.fileName}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Overlay states */}
            {isPendingOrProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[2px]">
                {job.status === "processing" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <Clock className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-xs font-medium text-muted-foreground">
                  {job.status === "processing" ? "Processing…" : "Pending"}
                </span>
              </div>
            )}
            {isFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[2px]">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <span className="text-xs font-medium text-destructive">
                  Failed
                </span>
              </div>
            )}
            <div className="absolute top-2 right-2">
              <StatusBadge status={job.status} />
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="truncate text-sm font-medium">{job.fileName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(job._creationTime).toLocaleString()}
            </p>
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return <Badge variant="secondary">Completed</Badge>
  if (status === "processing")
    return <Badge variant="default">Processing</Badge>
  if (status === "pending") return <Badge variant="outline">Pending</Badge>
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>
  return null
}
