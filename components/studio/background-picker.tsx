"use client"

import { useCallback, useRef, useState } from "react"
import Image from "next/image"
import { useDropzone } from "react-dropzone"
import { ImageIcon, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useBackgroundImageUpload } from "@/hooks/use-background-image-upload"
import {
  PRESET_COLORS,
  normalizeHexColor,
  type BackgroundConfig,
} from "@/lib/background"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

type BackgroundMode = "color" | "image"

interface BackgroundPickerProps {
  jobId: Id<"jobs">
  value?: BackgroundConfig
  onSolidChange: (background: { type: "solid"; color: string }) => void
  onImageUploaded: (background: {
    type: "image"
    imageUrl: string
    fileName: string
  }) => void | Promise<void>
  onClear: () => void
  disabled?: boolean
}

export function BackgroundPicker({
  jobId,
  value,
  onSolidChange,
  onImageUploaded,
  onClear,
  disabled = false,
}: BackgroundPickerProps) {
  const [mode, setMode] = useState<BackgroundMode>(
    value?.type === "image" ? "image" : "color"
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadBackgroundImage, uploading, error } =
    useBackgroundImageUpload(jobId)

  const activeColor = value?.type === "solid" ? value.color : undefined
  const customColor = activeColor ?? "#FFFFFF"

  const handleImageUpload = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return
      const { imageUrl, fileName } = await uploadBackgroundImage(file)
      setMode("image")
      await onImageUploaded({ type: "image", imageUrl, fileName })
    },
    [onImageUploaded, uploadBackgroundImage]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void handleImageUpload(files),
    accept: { "image/*": [] },
    multiple: false,
    disabled: uploading || disabled,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex rounded-full border bg-muted/50 p-1">
        {(["color", "image"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={cn(
              "flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors capitalize",
              mode === tab
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {mode === "color" && (
        <>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Presets</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((preset) => {
                const isActive = activeColor === preset.value

                return (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.label}
                    aria-label={preset.label}
                    onClick={() =>
                      !disabled && onSolidChange({ type: "solid", color: preset.value })
                    }
                    disabled={disabled}
                    className={cn(
                      "aspect-square rounded-full border-2 transition-transform hover:scale-105",
                      isActive
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border"
                    )}
                    style={{ backgroundColor: preset.value }}
                  />
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="custom-background-color"
              className="text-sm font-medium"
            >
              Custom color
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="custom-background-color"
                type="color"
                value={customColor}
                onChange={(event) => {
                  if (disabled) return
                  const color = normalizeHexColor(event.target.value)
                  onSolidChange({ type: "solid", color })
                }}
                disabled={disabled}
                className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent p-1"
              />
              <span className="font-mono text-sm text-muted-foreground">
                {customColor}
              </span>
            </div>
          </div>
        </>
      )}

      {mode === "image" && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Upload image</Label>

          {value?.type === "image" && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/30">
              <Image
                src={value.imageUrl}
                alt={value.fileName ?? "Background image"}
                fill
                sizes="280px"
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          <div
            {...getRootProps()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30",
              uploading && "pointer-events-none opacity-60"
            )}
          >
            <input {...getInputProps()} />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImageUpload([file])
                event.target.value = ""
              }}
            />

            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : value?.type === "image" ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}

            <p className="text-center text-sm text-muted-foreground">
              {uploading
                ? "Uploading..."
                : isDragActive
                  ? "Drop image here"
                  : value?.type === "image"
                    ? "Drag a new image or click below to replace"
                    : "Drag an image here"}
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || disabled}
              onClick={() => fileInputRef.current?.click()}
            >
              {value?.type === "image" ? "Replace image" : "Choose image"}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      )}

      {value && (
        <Button
          variant="outline"
          onClick={onClear}
          disabled={disabled}
          className="w-full"
        >
          Remove background
        </Button>
      )}
    </div>
  )
}
