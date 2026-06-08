"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { QueueList, useQueue } from "@/components/queue-provider"
import { List, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

/** Desktop-only floating queue panel. Mobile uses the header button + bottom sheet. */
export function QueueWidget() {
  const { jobs, status, activeCount, isEmpty, isLoading } = useQueue()
  const [open, setOpen] = React.useState(true)

  if (isLoading || isEmpty) return null

  return (
    <div className="fixed right-6 bottom-6 z-30 hidden flex-col items-end sm:flex">
      <Collapsible open={open} onOpenChange={setOpen} className="group w-80">
        <CollapsibleContent className="duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2">
          <div className="mb-4 overflow-hidden rounded-2xl border border-border/50 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl">
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
            </div>

            <QueueList showClearFinished />
          </div>
        </CollapsibleContent>

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
