"use client"

import Link from "next/link"
import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { useAction, usePaginatedQuery } from "convex/react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Clock,
  AlertCircle,
  Loader2,
  ImageOff,
  Download,
  CheckSquare,
  Trash2,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { useLongPress } from "@/hooks/use-long-press"

export default function ResultsPage() {
  const {
    results: jobs,
    status,
    loadMore,
  } = usePaginatedQuery(api.jobs.getResults, {}, { initialNumItems: 12 })

  const deleteJobAndFiles = useAction(api.jobs.deleteJobAndFiles)
  const deleteJobsAndFiles = useAction(api.jobs.deleteJobsAndFiles)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<Id<"jobs">>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<Id<"jobs">>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [singleDeleteJobId, setSingleDeleteJobId] =
    useState<Id<"jobs"> | null>(null)

  const jobIds = useMemo(() => new Set(jobs.map((j) => j._id)), [jobs])

  const allSelected =
    jobs.length > 0 && jobs.every((j) => selectedIds.has(j._id))

  const someSelected = jobs.some((j) => selectedIds.has(j._id))

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  const enterSelectionMode = useCallback((jobId?: Id<"jobs">) => {
    setSelectionMode(true)
    if (jobId) {
      setSelectedIds(new Set([jobId]))
    }
  }, [])

  const toggleSelect = useCallback((jobId: Id<"jobs">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        for (const id of jobIds) {
          next.delete(id)
        }
      } else {
        for (const id of jobIds) {
          next.add(id)
        }
      }
      return next
    })
  }, [allSelected, jobIds])

  const handleSingleDelete = useCallback(
    async (jobId: Id<"jobs">) => {
      setDeletingIds((prev) => new Set(prev).add(jobId))
      try {
        await deleteJobAndFiles({ jobId })
        setSelectedIds((prev) => {
          if (!prev.has(jobId)) return prev
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
      } catch (err) {
        console.error("Failed to delete job:", err)
        toast.error("Failed to delete job")
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
      }
    },
    [deleteJobAndFiles]
  )

  const handleBulkDelete = useCallback(async () => {
    const jobIds = [...selectedIds]
    if (jobIds.length === 0) return

    setIsBulkDeleting(true)
    try {
      await deleteJobsAndFiles({ jobIds })
      toast.success(
        jobIds.length === 1
          ? "1 job deleted"
          : `${jobIds.length} jobs deleted`
      )
      exitSelectionMode()
      setBulkDeleteDialogOpen(false)
    } catch (err) {
      console.error("Failed to delete jobs:", err)
      toast.error("Failed to delete selected jobs")
    } finally {
      setIsBulkDeleting(false)
    }
  }, [deleteJobsAndFiles, exitSelectionMode, selectedIds])

  const selectedCount = selectedIds.size

  const pendingDeleteJob = useMemo(
    () =>
      singleDeleteJobId
        ? jobs.find((job) => job._id === singleDeleteJobId)
        : undefined,
    [jobs, singleDeleteJobId]
  )

  const isSingleDeleting =
    singleDeleteJobId !== null && deletingIds.has(singleDeleteJobId)

  return (
    <>
      <main
        className={cn(
          "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8",
          selectionMode && "pb-24 sm:pb-10"
        )}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {!selectionMode ? (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => enterSelectionMode()}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Select
              </Button>
            ) : (
              <div className="hidden flex-wrap items-center gap-2 sm:flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exitSelectionMode}
                  disabled={isBulkDeleting}
                >
                  Cancel
                </Button>
                <span className="px-1 text-sm font-medium text-muted-foreground">
                  {selectedCount} selected
                </span>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-desktop"
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleSelectAll}
                    disabled={jobs.length === 0 || isBulkDeleting}
                  />
                  <Label
                    htmlFor="select-all-desktop"
                    className="cursor-pointer text-sm font-normal normal-case tracking-normal"
                  >
                    Select all
                  </Label>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedCount === 0 || isBulkDeleting}
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {status === "LoadingFirstPage" ? (
            <div className="flex min-h-100 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/50 bg-card/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                Loading your jobs...
              </p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="animate-fade-in flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-border/50 bg-card/50 py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ImageOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">No images yet</h3>
                <p className="text-sm text-muted-foreground">
                  Upload images to get started.
                </p>
              </div>
              <Button asChild variant="outline" className="mt-2">
                <Link href="/">Upload images</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="animate-fade-in grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job._id}
                    job={job}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(job._id)}
                    onToggleSelect={() => toggleSelect(job._id)}
                    onEnterSelectionMode={() => enterSelectionMode(job._id)}
                    onDelete={() => setSingleDeleteJobId(job._id)}
                    isDeleting={deletingIds.has(job._id)}
                  />
                ))}
              </div>

              {status === "CanLoadMore" && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => loadMore(12)}
                    className="min-w-37.5"
                  >
                    Load More
                  </Button>
                </div>
              )}

              {status === "LoadingMore" && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" disabled className="min-w-37.5">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {selectionMode && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-popover sm:hidden">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <p className="mb-3 text-center text-sm font-semibold">
              {selectedCount} selected
            </p>
            <div className="mb-3 flex items-center justify-center gap-2">
              <Checkbox
                id="select-all-mobile"
                checked={
                  allSelected
                    ? true
                    : someSelected
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={toggleSelectAll}
                disabled={jobs.length === 0 || isBulkDeleting}
              />
              <Label
                htmlFor="select-all-mobile"
                className="cursor-pointer text-sm font-normal normal-case tracking-normal"
              >
                Select all
              </Label>
            </div>
            <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
              <Button
                variant="outline"
                className="flex-1"
                onClick={exitSelectionMode}
                disabled={isBulkDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={selectedCount === 0 || isBulkDeleting}
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} job{selectedCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected jobs and their files.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isBulkDeleting}
              onClick={(e) => {
                e.preventDefault()
                void handleBulkDelete()
              }}
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={singleDeleteJobId !== null}
        onOpenChange={(open) => {
          if (!open && !isSingleDeleting) {
            setSingleDeleteJobId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteJob ? (
                <>
                  <span className="font-medium text-foreground">
                    {pendingDeleteJob.fileName}
                  </span>{" "}
                  will be permanently deleted along with its files. This action
                  cannot be undone.
                </>
              ) : (
                "This will permanently delete the job and its files. This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSingleDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isSingleDeleting || !singleDeleteJobId}
              onClick={(e) => {
                e.preventDefault()
                if (!singleDeleteJobId) return
                void handleSingleDelete(singleDeleteJobId).finally(() => {
                  setSingleDeleteJobId(null)
                })
              }}
            >
              {isSingleDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function JobCard({
  job,
  selectionMode,
  selected,
  onToggleSelect,
  onEnterSelectionMode,
  onDelete,
  isDeleting,
}: {
  job: Doc<"jobs">
  selectionMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onEnterSelectionMode: () => void
  onDelete: () => void
  isDeleting?: boolean
}) {
  const showResult = job.status === "completed" && job.outputUrl
  const isFailed = job.status === "failed"
  const isPendingOrProcessing =
    job.status === "pending" || job.status === "processing"

  const { longPressHandlers } = useLongPress({
    onLongPress: onEnterSelectionMode,
    disabled: selectionMode,
  })

  const handleDownload = () => {
    const a = document.createElement("a")
    a.href = job.outputUrl!
    a.download = job.fileName
    a.click()
  }

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-shadow duration-300 ease-out",
        !selectionMode && "hover:shadow-md hover:ring-1 hover:ring-primary/20",
        selectionMode && selected && "ring-2 ring-primary"
      )}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <Image
            src={showResult ? job.outputUrl! : job.inputUrl}
            alt={job.fileName}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={cn(
              "pointer-events-none object-cover transition-transform duration-700",
              !selectionMode && "group-hover:scale-105",
              isFailed && "grayscale"
            )}
          />

          {isPendingOrProcessing && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm">
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
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <span className="text-sm font-semibold text-destructive">
                Failed
              </span>
            </div>
          )}

          {job.status === "processing" && (
            <div className="animate-shimmer pointer-events-none absolute inset-0" />
          )}

          {selectionMode ? (
            <div
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`Select ${job.fileName}`}
              onClick={onToggleSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onToggleSelect()
                }
              }}
              className="absolute inset-0 z-10 cursor-pointer"
            />
          ) : (
            <Link
              href={`/details/${job._id}`}
              aria-label={job.fileName}
              className="absolute inset-0 z-10"
              {...longPressHandlers}
            />
          )}

          {!selectionMode && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-3 left-3 z-30 h-8 w-8 bg-background/90 opacity-100 shadow-sm backdrop-blur-sm sm:opacity-0 sm:group-hover:opacity-100"
              disabled={isDeleting}
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label={`Delete ${job.fileName}`}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          )}

          <div className="pointer-events-none absolute top-3 right-3 z-30">
            {selectionMode ? (
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full shadow-sm transition-all duration-300 ease-out",
                  selected
                    ? "border-2 border-primary bg-primary text-primary-foreground"
                    : "border-2 border-background/90 bg-black/20"
                )}
              >
                <Check
                  className={cn(
                    "size-3.5 transition-all duration-300 ease-out",
                    selected ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  )}
                  strokeWidth={3}
                />
              </div>
            ) : showResult ? (
              <Button
                variant="secondary"
                size="icon"
                className="pointer-events-auto h-8 w-8 bg-background/90 shadow-sm backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload()
                }}
                aria-label={`Download ${job.fileName}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            ) : (
              <StatusBadge status={job.status} />
            )}
          </div>
        </div>

        <div
          role={selectionMode ? "button" : undefined}
          tabIndex={selectionMode ? 0 : undefined}
          aria-pressed={selectionMode ? selected : undefined}
          onClick={selectionMode ? onToggleSelect : undefined}
          onKeyDown={
            selectionMode
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onToggleSelect()
                  }
                }
              : undefined
          }
          className={cn(
            "border-t border-border/50 px-4 py-4",
            selectionMode && "cursor-pointer"
          )}
        >
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
