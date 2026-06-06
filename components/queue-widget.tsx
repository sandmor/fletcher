"use client"

import * as React from "react"
import Image from "next/image"
import { usePaginatedQuery, useAction, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { List, ChevronDown, ChevronUp, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function QueueWidget() {
  const {
    results: jobs,
    status,
    loadMore,
  } = usePaginatedQuery(api.jobs.getActiveQueue, {}, { initialNumItems: 20 })

  const deleteJobAndFiles = useAction(api.jobs.deleteJobAndFiles)
  const dismissFromQueue = useMutation(api.jobs.dismissFromQueue)
  const dismissFinishedFromQueue = useMutation(api.jobs.dismissFinishedFromQueue)

  const [open, setOpen] = React.useState(true)
  const [isClearing, setIsClearing] = React.useState(false)

  const pending = jobs.filter((j) => j.status === "pending")
  const processing = jobs.filter((j) => j.status === "processing")
  const completed = jobs.filter((j) => j.status === "completed")
  const failed = jobs.filter((j) => j.status === "failed")
  const activeCount = pending.length + processing.length

  const handleRemove = React.useCallback(
    async (job: (typeof jobs)[number]) => {
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

  if (status === "LoadingFirstPage") return null
  if (jobs.length === 0) return null

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end">
      <Collapsible open={open} onOpenChange={setOpen} className="group w-80">
        <CollapsibleContent className="duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2">
          <div className="mb-4 overflow-hidden rounded-2xl border border-border/50 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl">
            {/* Header section */}
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background shadow-sm">
                  <List className="h-3.5 w-3.5 text-foreground" />
                </div>
                Queue
                <span className="flex h-5 items-center justify-center rounded-full bg-muted px-2 text-[10px] font-medium text-muted-foreground">
                  {jobs.length}
                  {status === "CanLoadMore" ? "+" : ""} total
                </span>
              </div>
              {(completed.length > 0 || failed.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isClearing}
                  className="h-7 border-dashed border-border/60 px-2.5 text-xs font-medium hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleClearFinished}
                >
                  {isClearing ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  Clear finished
                </Button>
              )}
            </div>

            {/* List and Infinite Scroll area */}
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
                      className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRemove(job)}
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

              {/* Load more triggers */}
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
        </CollapsibleContent>

        {/* Sticky Trigger bar */}
        <CollapsibleTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "h-12 w-full justify-between rounded-full px-5 shadow-xl transition-all duration-300",
              open
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <span className="flex items-center gap-2.5 font-semibold tracking-wide">
              <List className="h-4 w-4" />
              {open ? "HIDE QUEUE" : "SHOW QUEUE"}
              {!open && activeCount > 0 && (
                <span className="flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-background px-1.5 text-[11px] font-bold text-foreground">
                  {activeCount}
                </span>
              )}
            </span>
            {open ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronUp className="h-5 w-5" />
            )}
          </Button>
        </CollapsibleTrigger>
      </Collapsible>
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
