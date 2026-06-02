"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ImageUp, Upload } from "lucide-react"

export default function UploadPage() {
  const addJobs = useAppStore((s) => s.addJobs)
  const router = useRouter()

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length) addJobs(acceptedFiles)
    },
    [addJobs]
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
          Remove backgrounds instantly
        </h1>
        <p className="max-w-md text-muted-foreground">
          Drag and drop your images here. We’ll process them in the background
          so you can keep browsing.
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
