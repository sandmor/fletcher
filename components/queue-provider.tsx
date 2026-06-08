"use client"

import * as React from "react"
import Image from "next/image"
import { usePaginatedQuery, useAction, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Loader2, X } from "lucide-react"

type QueueJob = Doc<"jobs">

type QueueContextValue = {
  jobs: QueueJob[]
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  loadMore: (numItems: number) => void
  activeCount: number
  completedCount: number
  failedCount: number
  isLoading: boolean
  isEmpty: boolean
  isClearing: boolean
  handleRemove: (job: QueueJob) => Promise<void>
  handleClearFinished: () => Promise<void>
}

const QueueContext = React.createContext<QueueContextValue | null>(null)

export function useQueue() {
  const ctx = React.useContext(QueueContext)
  if (!ctx) {
    throw new Error("useQueue must be used within QueueProvider")
  }
  return ctx
}

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const {
    results: jobs,
    status,
    loadMore,
  } = usePaginatedQuery(api.jobs.getActiveQueue, {}, { initialNumItems: 20 })

  const deleteJobAndFiles = useAction(api.jobs.deleteJobAndFiles)
  const dismissFromQueue = useMutation(api.jobs.dismissFromQueue)
  const dismissFinishedFromQueue = useMutation(api.jobs.dismissFinishedFromQueue)

  const [isClearing, setIsClearing] = React.useState(false)

  const pending = jobs.filter((j) => j.status === "pending")
  const processing = jobs.filter((j) => j.status === "processing")
  const completed = jobs.filter((j) => j.status === "completed")
  const failed = jobs.filter((j) => j.status === "failed")
  const activeCount = pending.length + processing.length

  const handleRemove = React.useCallback(
    async (job: QueueJob) => {
      try {
        if (job.status === "completed" || job.status === "failed") {
          await dismissFromQueue({ jobId: job._id })
        } else {
          await deleteJobAndFiles({ jobId: job._id })
        }
      } catch (err) {
        console.error("Failed to remove job:", err)
      }
    },
    [deleteJobAndFiles, dismissFromQueue]
  )

  const handleClearFinished = React.useCallback(async () => {
    setIsClearing(true)
    try {
      await dismissFinishedFromQueue()
    } catch (err) {
      console.error("Failed to dismiss jobs:", err)
    } finally {
      setIsClearing(false)
    }
  }, [dismissFinishedFromQueue])

  const value = React.useMemo<QueueContextValue>(
    () => ({
      jobs,
      status,
      loadMore,
      activeCount,
      completedCount: completed.length,
      failedCount: failed.length,
      isLoading: status === "LoadingFirstPage",
      isEmpty: status !== "LoadingFirstPage" && jobs.length === 0,
      isClearing,
      handleRemove,
      handleClearFinished,
    }),
    [
      jobs,
      status,
      loadMore,
      activeCount,
      completed.length,
      failed.length,
      isClearing,
      handleRemove,
      handleClearFinished,
    ]
  )

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}

export function QueueList({
  showClearFinished = true,
  className,
}: {
  showClearFinished?: boolean
  className?: string
}) {
  const {
    jobs,
    status,
    loadMore,
    completedCount,
    failedCount,
    isClearing,
    handleRemove,
    handleClearFinished,
  } = useQueue()

  return (
    <div className={className}>
      {showClearFinished && (completedCount > 0 || failedCount > 0) && (
        <div className="flex justify-end border-b border-border/50 px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isClearing}
            className="h-7 border-dashed border-border/60 px-2.5 text-xs font-medium hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void handleClearFinished()}
          >
            {isClearing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Clear finished
          </Button>
        </div>
      )}

      <ScrollArea className="max-h-87.5">
        <ul className="divide-y divide-border/30">
          {jobs.map((job) => (
            <li
              key={job._id}
              className="group/item flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
                <Image
                  src={job.inputUrl}
                  alt={job.fileName}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
                {job.status === "processing" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {job.fileName}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <StatusIndicator status={job.status} />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground opacity-100 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover/item:opacity-100"
                onClick={() => void handleRemove(job)}
                aria-label={
                  job.status === "completed" || job.status === "failed"
                    ? "Dismiss from queue"
                    : "Cancel job"
                }
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>

        {status === "CanLoadMore" && (
          <div className="flex justify-center border-t border-border/20 bg-muted/10 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => loadMore(20)}
            >
              Load older jobs
            </Button>
          </div>
        )}

        {status === "LoadingMore" && (
          <div className="flex items-center justify-center gap-2 border-t border-border/20 p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Loading...
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function StatusIndicator({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <>
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-[11px] font-medium text-muted-foreground">
          Ready
        </span>
      </>
    )
  }
  if (status === "processing") {
    return (
      <>
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        <span className="text-[11px] font-medium text-primary">Processing</span>
      </>
    )
  }
  if (status === "pending") {
    return (
      <>
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        <span className="text-[11px] font-medium text-muted-foreground">
          Pending
        </span>
      </>
    )
  }
  if (status === "failed") {
    return (
      <>
        <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
        <span className="text-[11px] font-medium text-destructive">Failed</span>
      </>
    )
  }
  return null
}
