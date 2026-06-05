import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Doc } from "./_generated/dataModel"

export const storageClient = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle:
    process.env.S3_FORCE_PATH_STYLE === "true" || !!process.env.S3_ENDPOINT,
})

export function getPublicUrl(fileKey: string): string {
  const base = (process.env.S3_PUBLIC_URL_BASE || "").replace(/\/$/, "")
  return `${base}/${fileKey}`
}

export function getS3KeyFromUrl(url: string): string | null {
  const base = (process.env.S3_PUBLIC_URL_BASE || "").replace(/\/$/, "")
  if (!base || !url.startsWith(`${base}/`)) {
    return null
  }
  return url.slice(base.length + 1)
}

export async function deleteS3Object(key: string): Promise<void> {
  try {
    await storageClient.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
      })
    )
  } catch {
    /* best-effort */
  }
}

export async function deleteS3ObjectByUrl(url: string): Promise<void> {
  const key = getS3KeyFromUrl(url)
  if (key) {
    await deleteS3Object(key)
  }
}

export function getJobS3Keys(job: Doc<"jobs">): string[] {
  const keys: string[] = []

  const inputKey = getS3KeyFromUrl(job.inputUrl)
  if (inputKey) keys.push(inputKey)

  if (job.outputUrl) {
    const outputKey = getS3KeyFromUrl(job.outputUrl)
    if (outputKey) keys.push(outputKey)
  }

  if (job.background?.type === "image") {
    const backgroundKey = getS3KeyFromUrl(job.background.imageUrl)
    if (backgroundKey) keys.push(backgroundKey)
  }

  return keys
}

export function sanitizeFileName(fileName: string): string {
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf("."))
    : ""
  const base = fileName.includes(".")
    ? fileName.slice(0, fileName.lastIndexOf("."))
    : fileName
  const clean = base.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50)
  return `${clean}${ext}`
}

export function buildBackgroundKey(jobId: string, fileName: string): string {
  return `backgrounds/${jobId}/${Date.now()}-${sanitizeFileName(fileName)}`
}

export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(storageClient, command, { expiresIn })
}
