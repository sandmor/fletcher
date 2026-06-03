"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useUploadQueue } from "@/hooks/use-upload-queue"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  Trash2,
} from "lucide-react"

export default function UploadPage() {
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
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="animate-fade-in flex flex-col gap-8">
        <div className="space-y-3 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Remove backgrounds
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Drop your images below. We&apos;ll handle the rest.
          </p>
        </div>

        <Card
          {...getRootProps()}
          className={cn(
            "w-full cursor-pointer border-2 border-dashed transition-all duration-200",
            isDragActive
              ? "scale-[1.02] border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
          )}
        >
          <CardContent className="flex flex-col items-center justify-center gap-6 py-20">
            <input {...getInputProps()} />
            <div
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full transition-colors",
                isDragActive ? "bg-primary/20" : "bg-muted"
              )}
            >
              <Upload
                className={cn(
                  "h-10 w-10 transition-colors",
                  isDragActive ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>
            <div className="text-base font-medium text-muted-foreground">
              {isDragActive
                ? "Drop the images here ..."
                : "Drop images here or click to browse"}
            </div>
            <Button
              variant="outline"
              size="sm"
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
          <div className="animate-slide-up w-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Upload queue</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                  {items.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {uploadingCount > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Uploading {uploadingCount}…
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive"
                  onClick={clearAll}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear all
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group animate-fade-in flex items-center gap-4 rounded-xl border bg-card p-3 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted">
                    <img
                      src={item.previewUrl}
                      alt={item.fileName}
                      className="h-full w-full object-cover"
                    />
                    {item.status === "uploading" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.fileName}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {item.status === "uploading" && (
                        <span className="text-xs font-medium text-primary">
                          Uploading…
                        </span>
                      )}
                      {item.status === "uploaded" && (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs font-medium text-emerald-600">
                            Ready
                          </span>
                        </>
                      )}
                      {item.status === "error" && (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-xs font-medium text-destructive">
                            {item.error}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove upload"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="mt-2 w-full text-base shadow-lg transition-all hover:shadow-xl"
              disabled={!canSubmit}
              onClick={() => submitAll()}
            >
              <Send className="mr-2 h-5 w-5" />
              {uploadingCount > 0
                ? `Waiting for ${uploadingCount} upload${uploadingCount > 1 ? "s" : ""}…`
                : `Submit ${readyCount} job${readyCount > 1 ? "s" : ""}`}
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
