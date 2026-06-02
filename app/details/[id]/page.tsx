"use client"

import { useParams, useRouter } from "next/navigation"
import { useMemo } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download } from "lucide-react"

export default function DetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobs = useAppStore((s) => s.jobs)
  const job = useMemo(
    () => jobs.find((j) => j.id === params.id),
    [jobs, params.id]
  )

  if (!job) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold">Image not found</h1>
        <Button variant="link" onClick={() => router.push("/results")}>
          Back to results
        </Button>
      </main>
    )
  }

  const showBeforeAfter = job.status === "done" && job.removedUrl

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="truncate text-xl font-semibold tracking-tight">
          {job.fileName}
        </h1>
        <Badge>
          {job.status === "done"
            ? "Done"
            : job.status === "processing"
              ? "Processing"
              : job.status === "queued"
                ? "Queued"
                : "Error"}
        </Badge>
      </div>

      <div
        className={`grid gap-4 ${showBeforeAfter ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
      >
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3 text-sm font-medium text-muted-foreground">
              Original
            </div>
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <img
                src={job.originalUrl}
                alt="Original"
                className="h-full w-full object-cover"
              />
            </div>
          </CardContent>
        </Card>

        {showBeforeAfter && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Removed
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  asChild
                >
                  <a href={job.removedUrl!} download={job.fileName}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </Button>
              </div>
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={job.removedUrl!}
                  alt="Removed"
                  className="h-full w-full object-cover"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
