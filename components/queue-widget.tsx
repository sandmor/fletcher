"use client"

import * as React from "react"
import { useAppStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  const jobs = useAppStore((s) => s.jobs)
  const removeJob = useAppStore((s) => s.removeJob)
  const clearCompleted = useAppStore((s) => s.clearCompleted)
  const [open, setOpen] = React.useState(true)

  const queued = jobs.filter((j) => j.status === "queued")
  const processing = jobs.filter((j) => j.status === "processing")
  const done = jobs.filter((j) => j.status === "done")
  const error = jobs.filter((j) => j.status === "error")
  const activeCount = queued.length + processing.length

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
              {(done.length > 0 || error.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearCompleted}
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
                    <li key={job.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {job.fileName}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            {job.uploadStatus === "error" ? (
                              <Badge
                                variant="destructive"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                Upload failed
                              </Badge>
                            ) : job.uploadStatus === "uploading" ? (
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                Uploading…
                              </Badge>
                            ) : (
                              <StatusBadge status={job.status} />
                            )}
                            {job.status === "processing" && (
                              <span className="text-xs text-muted-foreground">
                                {Math.round(job.progress)}%
                              </span>
                            )}
                          </div>
                          {job.status === "processing" && (
                            <Progress
                              value={job.progress}
                              className="mt-2 h-1.5"
                            />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removeJob(job.id)}
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
    queued: {
      icon: <Clock className="h-3 w-3" />,
      label: "Queued",
      variant: "secondary",
    },
    processing: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "Processing",
      variant: "default",
    },
    done: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Done",
      variant: "outline",
    },
    error: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Error",
      variant: "destructive",
    },
  }
  const entry = map[status] ?? map.queued
  return (
    <Badge variant={entry.variant} className="gap-1 px-1.5 py-0 text-[10px]">
      {entry.icon}
      {entry.label}
    </Badge>
  )
}
