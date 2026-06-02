/**
 * Frontend S3 upload utilities.
 */

export interface PresignedUrlResponse {
  url: string
  remoteUrl: string
  key: string
}

export async function getPresignedUrl(
  fileName: string,
  contentType: string
): Promise<PresignedUrlResponse> {
  const res = await fetch("/api/upload/presigned", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Failed to get presigned URL: ${text}`)
  }

  return res.json() as Promise<PresignedUrlResponse>
}

export async function uploadToS3(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  })

  if (!res.ok) {
    throw new Error(
      `Upload failed with status ${res.status}: ${res.statusText}`
    )
  }
}
