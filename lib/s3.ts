/**
 * S3-compatible upload utilities.
 *
 * Design:
 * - Presigned PUT URLs are generated server-side via /api/upload/presigned.
 * - The client uploads directly to the S3-compatible storage from the browser.
 * - Images that fail to upload surface a clear error state; users can retry.
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

export async function deleteFromS3(key: string): Promise<void> {
  const res = await fetch("/api/upload/presigned", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Failed to delete object: ${text}`)
  }
}
