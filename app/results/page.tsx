"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useAppStore } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from "react"
import { Clock, AlertCircle, Loader2, ImageOff } from "lucide-react"

type Filter = "all" | "done" | "processing" | "queued" | "error"

export default function ResultsPage() {
  const jobs = useAppStore((s) => s.jobs)
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = useMemo(() => {
    if (filter === "all") return jobs
    return jobs.filter((j) => j.status === filter)
  }, [jobs, filter])

  const counts = useMemo(() => {
    return {
      all: jobs.length,
      done: jobs.filter((j) => j.status === "done").length,
      processing: jobs.filter((j) => j.status === "processing").length,
      queued: jobs.filter((j) => j.status === "queued").length,
      error: jobs.filter((j) => j.status === "error").length,
    }
  }, [jobs])

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
              <SelectItem value="done">Done ({counts.done})</SelectItem>
              <SelectItem value="processing">
                Processing ({counts.processing})
              </SelectItem>
              <SelectItem value="queued">Queued ({counts.queued})</SelectItem>
              <SelectItem value="error">Error ({counts.error})</SelectItem>
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
              <JobCard key={job.id} job={job} />
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
  job: ReturnType<typeof useAppStore.getState>["jobs"][number]
}) {
  return (
    <Card className="overflow-hidden transition-colors hover:bg-accent/40">
      <CardContent className="p-0">
        <Link href={`/details/${job.id}`} className="group block">
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            {job.status === "done" && job.removedUrl ? (
              <img
                src={job.removedUrl}
                alt={job.fileName}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : job.status === "processing" || job.status === "queued" ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                {job.status === "processing" ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Clock className="h-6 w-6" />
                )}
                <span className="text-xs">
                  {job.status === "processing" ? "Processing..." : "Queued"}
                </span>
              </div>
            ) : job.status === "error" ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <span className="text-xs">Failed</span>
              </div>
            ) : (
              <img
                src={job.originalUrl}
                alt={job.fileName}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute top-2 right-2">
              <StatusBadge status={job.status} />
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="truncate text-sm font-medium">{job.fileName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(job.createdAt).toLocaleString()}
            </p>
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "done") return <Badge variant="secondary">Done</Badge>
  if (status === "processing")
    return <Badge variant="default">Processing</Badge>
  if (status === "queued") return <Badge variant="outline">Queued</Badge>
  if (status === "error") return <Badge variant="destructive">Error</Badge>
  return null
}
