"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import { useUploadQueue } from "@/hooks/use-upload-queue"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ImageUp,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  Trash2,
} from "lucide-react"

export default function UploadPage() {
  const router = useRouter()
  const {
    items,
    addFiles,
    removeItem,
    clearAll,
    submitAll,
    uploadingCount,
    readyCount,
    canSubmit,
  } = useUploadQueue()

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length) addFiles(acceptedFiles)
    },
    [addFiles]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    noClick: false,
    noKeyboard: false,
  })

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="rounded-2xl border bg-primary p-4 text-primary-foreground shadow-lg">
          <ImageUp className="h-8 w-8" />
        </div>
        <h1 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
          Remove backgrounds automatically
        </h1>
        <p className="max-w-md text-muted-foreground">
          Drag and drop your images here, upload them, then submit a job to
          process them in the background.
        </p>

        <Card
          {...getRootProps()}
          className={cn(
            "w-full cursor-pointer border-2 border-dashed transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 bg-card hover:border-muted-foreground/40"
          )}
        >
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <input {...getInputProps()} />
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-sm text-muted-foreground">
              {isDragActive
                ? "Drop the images here ..."
                : "Drop images here or click to browse"}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation()
                open()
              }}
            >
              Choose files
            </Button>
          </CardContent>
        </Card>

        {items.length > 0 && (
          <div className="w-full space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Upload queue</span>
                <span className="text-xs text-muted-foreground">
                  ({items.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {uploadingCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading {uploadingCount}…
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearAll}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 pr-4 shadow-sm"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    <img
                      src={item.previewUrl}
                      alt={item.fileName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm font-medium">
                      {item.fileName}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {item.status === "uploading" && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Uploading…
                          </span>
                        </>
                      )}
                      {item.status === "uploaded" && (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span className="text-xs text-emerald-600">
                            Ready
                          </span>
                        </>
                      )}
                      {item.status === "error" && (
                        <>
                          <AlertCircle className="h-3 w-3 text-destructive" />
                          <span className="text-xs text-destructive">
                            {item.error}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove upload"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              disabled={!canSubmit}
              onClick={() => submitAll()}
            >
              <Send className="mr-2 h-4 w-4" />
              {uploadingCount > 0
                ? `Waiting for ${uploadingCount} upload${uploadingCount > 1 ? "s" : ""}…`
                : `Submit ${readyCount} job${readyCount > 1 ? "s" : ""}`}
            </Button>
          </div>
        )}

        <Button
          variant="link"
          size="sm"
          onClick={() => router.push("/results")}
        >
          View results →
        </Button>
      </div>
    </main>
  )
}
