"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, Loader2, Clock } from "lucide-react"

export default function DetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id
  const id = rawId ? (rawId as Id<"jobs">) : null
  const job = useQuery(api.jobs.getJobById, id ? { id } : "skip")

  if (!id || job === null) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold">Image not found</h1>
        <Button variant="link" onClick={() => router.push("/results")}>
          Back to results
        </Button>
      </main>
    )
  }

  if (job === undefined) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const showBeforeAfter = job.status === "completed" && job.outputUrl

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="truncate text-xl font-semibold tracking-tight">
          {job.fileName}
        </h1>
        <StatusLabel status={job.status} />
      </div>

      <div
        className={`grid gap-4 ${showBeforeAfter ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
      >
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">
                Original
              </span>
            </div>
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <img
                src={job.inputUrl}
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
                  <a href={job.outputUrl!} download={job.fileName}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </Button>
              </div>
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={job.outputUrl!}
                  alt="Removed"
                  className="h-full w-full object-cover"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {job.status === "processing" && (
          <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 md:col-span-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Processing…</span>
          </div>
        )}

        {job.status === "pending" && (
          <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 md:col-span-2">
            <Clock className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Pending</span>
          </div>
        )}

        {job.status === "failed" && (
          <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-destructive md:col-span-2">
            <span className="text-sm font-medium">Processing failed</span>
            {job.error && (
              <span className="max-w-md px-4 text-center text-xs text-muted-foreground">
                {job.error}
              </span>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function StatusLabel({ status }: { status: string }) {
  if (status === "completed")
    return <Badge variant="secondary">Completed</Badge>
  if (status === "processing")
    return <Badge variant="default">Processing</Badge>
  if (status === "pending") return <Badge variant="outline">Pending</Badge>
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>
  return null
}
