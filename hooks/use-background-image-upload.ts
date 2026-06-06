"use client"

import { useCallback, useState } from "react"
import { useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { uploadToS3 } from "@/lib/s3"

export function useBackgroundImageUpload(jobId: Id<"jobs">) {
  const getBackgroundUploadUrl = useAction(api.jobs.getBackgroundUploadUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadBackgroundImage = useCallback(
    async (file: File) => {
      setUploading(true)
      setError(null)

      try {
        const { uploadUrl, imageUrl } = await getBackgroundUploadUrl({
          jobId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        })

        await uploadToS3(uploadUrl, file)

        return { imageUrl, fileName: file.name }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to upload background"
        setError(message)
        throw err
      } finally {
        setUploading(false)
      }
    },
    [getBackgroundUploadUrl, jobId]
  )

  return { uploadBackgroundImage, uploading, error }
}
