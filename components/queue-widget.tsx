"use client"

import * as React from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  List,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react"

export function QueueWidget() {
  const jobs = useQuery(api.jobs.getQueue) ?? []
  const deleteJob = useMutation(api.jobs.deleteJob)
  const cleanupJobS3 = useAction(api.jobs.cleanupJobS3)
  const clearCompleted = useMutation(api.jobs.clearCompleted)
  const [open, setOpen] = React.useState(true)

  const pending = jobs.filter((j) => j.status === "pending")
  const processing = jobs.filter((j) => j.status === "processing")
  const completed = jobs.filter((j) => j.status === "completed")
  const failed = jobs.filter((j) => j.status === "failed")
  const activeCount = pending.length + processing.length

  const handleDelete = React.useCallback(
    async (job: (typeof jobs)[number]) => {
      await cleanupJobS3({ inputUrl: job.inputUrl, outputUrl: job.outputUrl })
      await deleteJob({ jobId: job._id })
    },
    [cleanupJobS3, deleteJob]
  )

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end">
      <Collapsible open={open} onOpenChange={setOpen} className="w-80">
        <CollapsibleContent>
          <div className="mb-3 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <List className="h-4 w-4 text-muted-foreground" />
                Jobs
                <span className="text-muted-foreground">({jobs.length})</span>
              </div>
              {(completed.length > 0 || failed.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => clearCompleted()}
                >
                  Clear completed
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-80">
              {jobs.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No jobs in queue.
                </div>
              ) : (
                <ul className="divide-y">
                  {jobs.map((job) => (
                    <li key={job._id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {job.fileName}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusBadge status={job.status} />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleDelete(job)}
                          aria-label="Remove job"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </CollapsibleContent>

        <CollapsibleTrigger asChild>
          <Button
            variant="secondary"
            className="w-full justify-between shadow-lg"
          >
            <span className="flex items-center gap-2">
              <List className="h-4 w-4" />
              QUEUE
              {activeCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 px-1.5 py-0 text-[10px]"
                >
                  {activeCount}
                </Badge>
              )}
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
      </Collapsible>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    {
      icon: React.ReactNode
      label: string
      variant: "default" | "secondary" | "destructive" | "outline"
    }
  > = {
    pending: {
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
      variant: "secondary",
    },
    processing: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "Processing",
      variant: "default",
    },
    completed: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Completed",
      variant: "outline",
    },
    failed: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Failed",
      variant: "destructive",
    },
  }
  const entry = map[status] ?? map.pending
  return (
    <Badge variant={entry.variant} className="gap-1 px-1.5 py-0 text-[10px]">
      {entry.icon}
      {entry.label}
    </Badge>
  )
}
