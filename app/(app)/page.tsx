"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useUploadQueue } from "@/hooks/use-upload-queue"
import { UploadCarousel } from "@/components/upload-carousel"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload } from "lucide-react"

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

        {items.length === 0 ? (
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
        ) : (
          <UploadCarousel
            items={items}
            addFiles={addFiles}
            removeItem={removeItem}
            clearAll={clearAll}
            submitAll={submitAll}
            uploadingCount={uploadingCount}
            readyCount={readyCount}
            canSubmit={canSubmit}
          />
        )}
      </div>
    </main>
  )
}
